# RUNBOOK — Incident Response

## Severity definitions

| Sev | Definition | Response | Comms |
|---|---|---|---|
| **Sev-1** | Production fully down (no users can sign in) **or** confirmed PHI exposure **or** active intrusion | 15 min ack, 1 h mitigation, war-room | LVPEI ops + Vaidix engineering lead immediately |
| **Sev-2** | Degraded — a major surface (live video, recording playback, document upload) failing for ≥ 10 % of cohort | 1 h ack, same-day mitigation | Cohort faculty channel |
| **Sev-3** | Bug or cosmetic issue affecting a few users; workarounds exist | Next business day | Ticket only |

## First 15 minutes (all severities)

1. **Acknowledge** in the on-call channel with timestamp.
2. **Capture state** — do this BEFORE making changes:
   ```bash
   mkdir -p /tmp/incident-$(date +%Y%m%dT%H%M%S) && cd $_
   docker compose -f /opt/vaidix/docker-compose.prod.yml ps > services.txt
   docker compose -f /opt/vaidix/docker-compose.prod.yml logs --since=15m > logs.txt
   curl -s https://app.vaidix.lvpei.org/api/ready > ready.json
   ```
3. **Decide:** mitigate vs. investigate. Mitigation always wins during a Sev-1.

## Common mitigations

| Symptom | Mitigation |
|---|---|
| `/api/ready` shows `redis: down` | `docker compose restart redis`. Rate limiter for sensitive buckets is fail-closed (HARDENING-PLAN #11) — sign-in will return 429 until Redis recovers. Expected. |
| `/api/ready` shows `postgres: down` | Check disk on `/var`, then `docker compose restart` of any app service holding bad connections. If primary is unrecoverable → [RUNBOOK-PG-FAILOVER.md](RUNBOOK-PG-FAILOVER.md). |
| LiveKit signalling drops | `docker compose restart livekit` — sessions reconnect automatically inside ~30s. |
| MinIO out of space | Lifecycle eviction is in the retention worker (HARDENING-PLAN #16). Manually expire old objects via `mc rm --recursive --force --older-than 365d minio/vaidix/recordings/`. |
| Suspected credential leak | Run [RUNBOOK-SECRET-ROTATE.md](RUNBOOK-SECRET-ROTATE.md) end-to-end. Bump `passwordVersion` for all admins (forces re-login within 30s, HARDENING-PLAN #13). |
| Suspected intrusion | Cut external access at the firewall. Pull last 24h of `audit_events`. Snapshot the host before forensics. |

## Communication template (Sev-1)

```
TITLE: [Vaidix Sev-1] <one-line description>

DETECTED: <UTC timestamp>
CURRENT STATE: <up | degraded | down>
USER IMPACT: <who, how many, what's broken>
NEXT UPDATE: <UTC time, ≤30 min from now>

WHAT WE KNOW:
- ...

WHAT WE'RE DOING:
- ...
```

## Post-incident

- File a follow-up issue tagged `incident` referencing the captured state directory.
- Within 5 business days, write a one-page post-mortem: timeline, contributing factors, what we'd change. Add the change to [HARDENING-PLAN.md](HARDENING-PLAN.md) only if it's a generalisable item, not a one-off fix.
