# RUNBOOK — Postgres Failover

HARDENING-PLAN.md item #6.

**Auto-failover is OFF in v1** — Phase 1 picks correctness over availability so a flaky network can't promote a replica that's behind the primary. Promotion is a deliberate human action.

## Detect

`/api/ready` returns 503 with `postgres: down`. Logs show repeated `connection refused` from app/workers. Confirm primary is unrecoverable, not just busy.

## Decide (≤2 minutes)

| Symptom | Action |
|---|---|
| Primary container stopped | `docker compose start postgres-primary` — try this first |
| Disk full on primary | Free space, restart |
| Confirmed disk corruption / hardware loss | **Promote replica** (below) |

## Promote replica (irreversible)

1. **Confirm replica lag is acceptable.**
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.ha.yml exec postgres-replica \
     psql -U vaidix_admin -d vaidix -c "SELECT now() - pg_last_xact_replay_timestamp() AS lag;"
   ```
   Lag > 5 minutes? Confirm with stakeholders that the data loss is acceptable before proceeding.

2. **Stop primary** so it can't accept writes.
   ```bash
   docker compose stop postgres-primary
   ```

3. **Promote.**
   ```bash
   docker compose exec postgres-replica psql -U vaidix_admin -d vaidix -c "SELECT pg_promote();"
   ```

4. **Repoint app + workers.** Edit `vaidix.env.enc`:
   ```
   DATABASE_URL=postgresql://vaidix_app:****@postgres-replica:5432/vaidix?...
   ```
   Reseal, redeploy app + workers.
   ```bash
   ./scripts/seal-env.sh && ./scripts/load-env.sh
   docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app workers
   ```

5. **Verify.**
   ```bash
   curl -fsS https://app.vaidix.lvpei.org/api/ready
   docker compose logs --since=2m app workers | grep -i error
   ```

6. **Audit-log the action** — there's no automatic audit row for this; manually run:
   ```bash
   docker compose exec app psql "$DATABASE_URL" -c \
     "INSERT INTO audit_events (id, event_type, summary, success) \
      VALUES (gen_random_uuid()::text, 'admin.pg_failover', 'manual promote', true);"
   ```

## Rebuild a new replica afterwards

The promoted replica is now the primary. Provision a new host as the new replica:

```bash
docker volume rm vaidix-pg-replica
docker compose -f docker-compose.prod.yml -f docker-compose.ha.yml up -d postgres-replica
# pg_basebackup runs automatically per docker-compose.ha.yml
```

## What we don't do (explicitly out of scope for Phase 1)

- Auto-failover via Patroni / Stolon — adds complexity LVPEI's first cohort doesn't justify.
- Logical replication for cross-region — single-region by DPDPA design (item #17).
- LiveKit clustering — single-node accepted; fast-restart runbook is the mitigation.
