# G3 — Pilot Playbook (≤30 users, 14 days)

**Goal:** prove Vaidix runs cleanly under real LVPEI cohort load before opening to the full institute. Single-cohort, time-boxed, instrumented, with a ramp-down decision point at day 7.

## Entry criteria (all must be ✅ before day 0)

- [ ] G2 verification (`scripts/g2-verify.sh`) returned exit 0 with no FAILs.
- [ ] At least one **clean restore drill** completed in the last 7 days ([RUNBOOK-BACKUP.md](RUNBOOK-BACKUP.md)).
- [ ] LiveKit 100-user load test ran on real hardware; the proven max is now in `livekit.yaml:max_participants` ([LOAD-TEST-RESULTS.md](LOAD-TEST-RESULTS.md)).
- [ ] Legal review of [COMPLIANCE-DPDPA.md](COMPLIANCE-DPDPA.md) signed off (or accepted-with-conditions documented).
- [ ] On-call rotation defined for the 14 days. Two named operators, one primary one secondary, escalation to engineering lead after 30 min.
- [ ] All cohort users have signed the consent rider for `PATIENT_RECORDING` + `RESIDENT_PLATFORM` (either via UI or paper-then-imported).

## Exit criteria (decide on day 14)

| Decision | Trigger |
|---|---|
| **Promote to full rollout** | Zero Sev-1, ≤ 2 Sev-2, no DPDPA exposure, < 5 % failed background jobs in DLQ, p95 page load < 2 s, LiveKit room success rate ≥ 99 % |
| **Extend pilot 7d** | One Sev-1 OR ≥ 3 Sev-2 with same-day mitigation but post-mortem still pending |
| **Pause + re-baseline** | Two+ Sev-1 OR DPDPA exposure OR data loss OR audit-log tamper alert |

## Daily check (15 min, primary on-call)

Run these checks every morning at 09:00 IST. Paste output into `#vaidix-pilot` channel.

### 1. Health snapshot

```bash
curl -fsS https://app.vaidix.lvpei.org/api/ready | jq
docker compose -f docker-compose.prod.yml ps
df -h /var/lib/docker
```

Expected: `ok:true`, all services `healthy`, `/var` < 80 % full.

### 2. Failed-jobs surface (DLQ)

```bash
curl -fsS -b admin.cookie https://app.vaidix.lvpei.org/api/admin/jobs/failed | jq '{count, items: .items[0:5]}'
```

Threshold: `count` > 10 → investigate the worker that's failing. > 50 → page secondary on-call.

### 3. Audit anomaly query

Run as a DB-admin-role connection (the runtime app role can't UPDATE/DELETE — by design):

```sql
-- Failed events in the last 24h, grouped
SELECT "eventType", count(*) AS n
  FROM audit_events
 WHERE "createdAt" > now() - interval '24 hours'
   AND success = false
 GROUP BY 1
 ORDER BY n DESC;

-- Login failures per email (potential brute force)
SELECT details->>'email' AS email, count(*) AS attempts
  FROM audit_events
 WHERE "eventType" = 'auth.login.failed'
   AND "createdAt" > now() - interval '24 hours'
 GROUP BY 1
 HAVING count(*) >= 5
 ORDER BY attempts DESC;

-- Session revocations (HARDENING-PLAN #13)
SELECT count(*) AS revoked_sessions
  FROM audit_events
 WHERE "eventType" = 'user.status_changed'
   AND "createdAt" > now() - interval '24 hours';

-- DSR activity (HARDENING-PLAN #17)
SELECT "eventType", count(*) FROM audit_events
 WHERE "eventType" LIKE 'dsr.%'
   AND "createdAt" > now() - interval '24 hours'
 GROUP BY 1;

-- Recording share usage
SELECT "eventType", count(*) FROM audit_events
 WHERE "eventType" LIKE 'recording_share.%'
   AND "createdAt" > now() - interval '24 hours'
 GROUP BY 1;
```

Threshold flags:
- Login failures ≥ 5 same email → manually lock the account, contact user.
- Session revocations > 0 unplanned → look at what changed.
- `recording_share.blocked` > 5 → likely abuse / wrong password attempts on a shared link.
- Anything in `dsr.*` → pull the request id, route to the DPDPA reviewer (admin/PD).

### 4. Live session metrics (during cohort hours)

```sql
-- Active sessions in the last hour
SELECT title, status, host_id,
       extract(epoch from (now() - "createdAt"))/60 AS age_min
  FROM teaching_sessions
 WHERE status IN ('LIVE', 'STARTING')
   AND "createdAt" > now() - interval '1 hour';

-- Recordings stuck in pipeline > 30 min
SELECT id, status, "sessionId", "createdAt"
  FROM recordings
 WHERE status NOT IN ('READY', 'FAILED', 'EXPUNGED')
   AND "createdAt" < now() - interval '30 minutes';

-- LiveKit connection issues today
SELECT details->>'reason' AS reason, count(*)
  FROM audit_events
 WHERE "eventType" = 'session.join_failed'
   AND "createdAt"::date = current_date
 GROUP BY 1;
```

### 5. Disk + memory headroom

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

Threshold: any container > 90 % memory, > 80 % CPU sustained → file a Sev-2.

## Weekly check (Friday afternoon, primary + engineering)

In addition to daily:

1. **Run the security e2e pack** against prod: `npx playwright test tests/e2e/security.spec.ts` — expect 8/8 green.
2. **Restore drill** if not in the last 7d ([RUNBOOK-BACKUP.md](RUNBOOK-BACKUP.md)).
3. **Review audit log integrity**:
   ```sql
   -- No gaps > 5 min during business hours
   WITH t AS (
     SELECT "createdAt",
            lag("createdAt") OVER (ORDER BY "createdAt") AS prev
       FROM audit_events
      WHERE "createdAt" > now() - interval '7 days'
   )
   SELECT "createdAt", prev, "createdAt" - prev AS gap
     FROM t
    WHERE "createdAt" - prev > interval '5 minutes'
      AND extract(hour from "createdAt") BETWEEN 8 AND 20
    ORDER BY gap DESC LIMIT 10;
   ```
4. **Review retention sweep activity**:
   ```sql
   SELECT "entityType", "lastSweepAt"
     FROM retention_policies
    WHERE active = true
    ORDER BY "lastSweepAt" NULLS FIRST;
   ```
   Anything not swept in > 25 hours = the cron isn't running.

## Weekly user-facing pulse (Saturday, faculty lead)

Send a 4-question pulse to all pilot users; treat anything below "agree" as a finding:

1. "I was able to do what I wanted in Vaidix this week." (1–5)
2. "Vaidix was responsive enough." (1–5)
3. "I encountered a privacy or data concern." (yes/no — if yes: free-text)
4. "I'd recommend opening this to the rest of the institute." (1–5)

## Incident handling during pilot

Follow [RUNBOOK-INCIDENT.md](RUNBOOK-INCIDENT.md). Pilot-specific addenda:

- A Sev-1 during pilot freezes new enrollment until post-mortem complete.
- A Sev-2 with same-day mitigation does not pause the pilot; just log it.
- Three Sev-2s in seven days = treat the next as Sev-1.

## Day-0 dry-run (cohort orientation, before real classes)

Before any live class:

1. All cohort users sign in once.
2. One faculty starts a 10-min test session with two residents joining.
3. Recording finishes processing (verify `Recording.status = READY`).
4. Resident submits a pre-question; faculty sees it in the dashboard.
5. Faculty sends a Coach question (`#19`); response returns within 5 s.
6. Faculty uploads a redacted document; PHI scan completes; tag-to-session works.
7. Each user is invited to test the data-export DSR flow; tarball arrives within 24 h.

Day-0 results go into [G3-PILOT-DAY0.md](G3-PILOT-DAY0.md) (operator creates this file at first run).

## Pilot promotion checklist (day 14)

- [ ] All daily checks ran every day.
- [ ] No Sev-1 unresolved.
- [ ] All Sev-2 incidents have post-mortems.
- [ ] DLQ never exceeded 50 jobs.
- [ ] At least one DSR export was tested end-to-end.
- [ ] User-facing pulse averages ≥ 4 on questions 1, 2, 4 and 0 % on Q3.
- [ ] Backup restore drill run during the pilot, < 30 min RTO confirmed.
- [ ] Audit-log integrity check has zero gaps > 5 min during business hours.
- [ ] LiveKit reported peak concurrent ≤ proven capacity from load test.

If all checked: promote. If any fail: extend or pause per the decision matrix at the top.
