# RUNBOOK — Backup / Restore

HARDENING-PLAN.md item #5.

## What's backed up

| Data | Mechanism | Frequency |
|---|---|---|
| Postgres (everything) | `pg_dump --format=custom` → age-encrypted | Nightly |
| MinIO (recordings, transcripts, documents, dsr-export, etc.) | `mc mirror` → tar → age-encrypted | Nightly |
| Audit log | Inside Postgres dump (append-only, see HARDENING-PLAN #14) | Nightly |
| Redis | NOT backed up — Redis is cache only; on restart BullMQ re-derives state from DB | n/a |

## Initial setup (once)

```bash
# 1. Generate the BACKUP keypair on a trusted offline workstation.
age-keygen -o /tmp/backup.key
sudo install -m 0600 /tmp/backup.key /etc/vaidix/backup.key
sudo grep '^# public key:' /etc/vaidix/backup.key | awk '{print $4}' \
   | sudo tee /etc/vaidix/backup.pub
shred -u /tmp/backup.key

# 2. Off-host destination (rclone) — run interactively once.
rclone config       # add a remote named "vaidix-offsite"
                    # NAS / s3 / b2 / gcs — operator's choice

# 3. Schedule.
sudo cp scripts/backup.sh /usr/local/bin/vaidix-backup
sudo crontab -l > /tmp/cron.bak; cat >> /tmp/cron.bak <<'EOF'
30 2 * * * /usr/local/bin/vaidix-backup >> /var/log/vaidix-backup.log 2>&1
EOF
sudo crontab /tmp/cron.bak && rm /tmp/cron.bak
```

## Monthly restore drill (mandatory)

The first Monday of each month. Bring the system up on a SECOND host from yesterday's backup; smoke-test sign-in + start a session; record the outcome in this file.

```bash
# On the drill host:
./scripts/load-env.sh
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres minio redis
./scripts/restore.sh /backup/<latest-date>
docker compose -f docker-compose.prod.yml --env-file .env up -d
curl -fsS https://drill-app.vaidix.lvpei.org/api/ready | jq
```

If the drill takes more than 30 min, that's a finding — log it as a HARDENING-PLAN follow-up.

## Drill log

| Date | Source backup | RTO (mm:ss) | Outcome | Notes |
|---|---|---|---|---|
| _yet to run_ | — | — | — | first drill before LVPEI cutover |

## Restore in a real incident

Same `./scripts/restore.sh <dir>` command. Pre-flight:
1. Confirm the backup dir's `SHA256SUMS` verifies (script does this automatically).
2. Stop the app + workers (`docker compose stop app workers`) — leave Postgres/MinIO running.
3. Restore.
4. Start app + workers; check `/api/ready`.
5. Audit-trail a `RESTORE_PERFORMED` event so the next operator sees what happened.

If the restore comes from > 24h ago, expect data loss in that gap; communicate scope to LVPEI before users return.
