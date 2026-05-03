# RUNBOOK — Operator First Day

**Audience:** the on-call engineer the day Vaidix goes live for a new cohort.

## Top 5 you'll be asked

1. **"Is it up?"** → `curl -fsS https://app.vaidix.lvpei.org/api/ready` should return `{"ok":true,"deps":[...]}`. If 503, look at `deps[].error` to see which dependency is unhealthy.
2. **"My session won't start"** → Check `vaidix-livekit` is healthy: `docker compose -f docker-compose.prod.yml ps livekit`. UDP ports 7882 + 50000-50100 must be open. Look for `[livekit]` lines in logs.
3. **"Recording isn't ready"** → `vaidix-livekit-egress` does the recording, `workers` does transcode + transcribe. Check `Recording.status` in Prisma Studio (`docker compose exec app npx prisma studio`). Stuck statuses: `RECORDING_FAILED`, `TRANSCODING_FAILED`, `TRANSCRIBING_FAILED` — see [RUNBOOK-INCIDENT.md](RUNBOOK-INCIDENT.md).
4. **"I can't log in"** → Check `audit_events` for `auth.login.failed` events for that email. If `lockedUntil` is set, an admin can clear it from the user-admin page. If the user changed password and is still being kicked out, that's the W6.5 `passwordVersion` re-check working as designed (HARDENING-PLAN item #13).
5. **"WhatsApp pearls aren't going out"** → Check `whatsapp-worker` logs and the user's `ConsentRecord` row. No row = no send (correct behaviour).

## Where things live

- **App logs:** `docker compose -f docker-compose.prod.yml logs -f app workers`
- **Nginx access log:** `docker compose exec nginx tail -F /var/log/nginx/access.log` (JSON, includes `req_id`)
- **DB shell:** `docker compose exec app npx prisma studio`
- **Recordings on disk:** `/var/lib/docker/volumes/vaidix-recordings/_data/`
- **Documents bucket:** MinIO console at `https://s3.vaidix.lvpei.org:9443/` (admin only — restrict at firewall)

## Daily ritual (5 min)

```bash
# 1. health
curl -fsS https://app.vaidix.lvpei.org/api/ready | jq

# 2. failed jobs (HARDENING-PLAN item #8 once shipped)
curl -fsS -H "Cookie: …admin session…" https://app.vaidix.lvpei.org/api/admin/jobs/failed | jq

# 3. last 24h audit anomalies
docker compose exec app psql "$DATABASE_URL" -c \
  "select event_type, count(*) from audit_events
     where created_at > now() - interval '24 hours' and success = false
     group by 1 order by 2 desc;"

# 4. disk
df -h /var/lib/docker
```

## Escalation

- **Sev-1 (down or PHI exposure):** stop session enrollment, page Vaidix engineering lead, follow [RUNBOOK-INCIDENT.md](RUNBOOK-INCIDENT.md).
- **Sev-2 (degraded):** open ticket; can be next-business-day if cohort isn't actively in session.
- **Sev-3 (cosmetic):** queue for the next release.
