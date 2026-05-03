# Vaidix Hardening Plan — W6.5 Pre-Production

| Field | Value |
|---|---|
| **Status** | **All 21 items shipped to code (2026-04-25).** Operator actions remain (cert provisioning, secret rotation, restore drill, load test on real hardware, prisma generate + migrate deploy). See per-row status column. |
| **Trigger** | W0–W6 feature delivery is real, but operational/security/compliance gaps would fail an LVPEI procurement review. See [VAIDIX-BUILD-PLAN-NOW.md](../VAIDIX-BUILD-PLAN-NOW.md). |
| **Goal** | Close 21 ranked blockers so the platform can be deployed on LVPEI on-prem and pass third-party / Codex security review. |
| **Scope exclusion** | 2FA for ADMIN / Program Director — explicitly deferred. Documented residual risk only. |
| **Sprints** | H1 (deploy/secrets/TLS), H2 (data integrity/observability/scale), H3 (security & compliance). ~22 dev-days, ~3 calendar weeks at 2 engineers. |

---

## Ranked punch list

Effort sizes: **S** ≤ 1 day · **M** 1–3 days · **L** 4–7 days. Status: ⏳ pending · 🚧 in progress · ✅ done · 🛑 blocked on operator.

### H1 — Deploy / Secrets / TLS

| # | Item | Effort | Status | Owner action required at end |
|---|---|---|---|---|
| 1 | `docker-compose.prod.yml` + `Dockerfile` + `.dockerignore` | M | ✅ | Operator provisions hostnames |
| 2 | nginx TLS site configs (`app`, `livekit`, `s3`) + HSTS + security headers | M | ✅ | **Operator provisions certs** ([RUNBOOK-CERT-ROTATE.md](RUNBOOK-CERT-ROTATE.md)) |
| 3 | Sealed env loader (`age`) + `seal-env.sh`/`load-env.sh` + rotation runbook | M | ✅ | **Operator runs initial keygen + rotates every secret in `.env.local`** ([RUNBOOK-SECRET-ROTATE.md](RUNBOOK-SECRET-ROTATE.md)) |
| 4 | `/api/health` (process) and `/api/ready` (deps) endpoints | S | ✅ | None |

### H2 — Data integrity / Observability / Scale

| # | Item | Effort | Status | Owner action |
|---|---|---|---|---|
| 5 | Encrypted backup + restore drill — `scripts/backup.sh`, `scripts/restore.sh`, [RUNBOOK-BACKUP.md](RUNBOOK-BACKUP.md) | M | ✅ | **Operator generates `/etc/vaidix/backup.key`, configures rclone remote, runs first restore drill** |
| 6 | HA — `docker-compose.ha.yml` (PG primary + replica + Redis Sentinel + replica), [RUNBOOK-PG-FAILOVER.md](RUNBOOK-PG-FAILOVER.md) | L | ✅ | **Operator provisions second PG host volume, runs `pg_basebackup` smoke test** |
| 7 | Structured JSON logs (`src/lib/log.ts`) + `x-request-id` set + propagated by nginx; pino dep added for future swap-in | M | ✅ | Wire log shipper (Loki/Vector) at deploy if desired |
| 8 | DLQ watcher (`src/server/workers/dlq-watcher.ts`) + admin endpoints `GET /api/admin/jobs/failed` and `POST /api/admin/jobs/retry/[id]` + `WORKER_JOB_DLQ` audit event | M | ✅ | None |
| 9 | Prisma connection pool: `connection_limit=30&pool_timeout=20` documented in `.env.example` and `src/lib/db.ts` | S | ✅ | Operator updates DATABASE_URL on host |
| 10 | MinIO bucket policy + lifecycle (`scripts/minio-policy.json`, `scripts/apply-minio-policy.sh`) | S | ✅ | **Operator runs `apply-minio-policy.sh` once on the prod host; rotates app S3 credentials** |

### H3 — Security & Compliance

| # | Item | Effort | Status | Owner action |
|---|---|---|---|---|
| 11 | Rate limiter fail-closed for sensitive buckets | S | ✅ | None |
| 12 | Hash recording-share tokens at rest (sha256 lookup) | M | ✅ | **Operator runs `prisma migrate deploy` on prod** (new migration `20260425160000_recording_share_token_hash`) |
| 13 | `passwordVersion` re-check in `requireAuth()` (Redis-cached 30s) | M | ✅ | None |
| 14 | Audit log: app-role revoke UPDATE/DELETE via SQL trigger, idempotency column, durable queued retry path (`src/server/workers/audit-worker.ts`) — migration `20260425170000_audit_append_only` | M | ✅ | **Operator must connect runtime app as the `vaidix_app` role (least privilege), not as DB superuser** |
| 15 | CSRF double-submit cookie + header (`requireCsrf()` helper, `/api/csrf` bootstrap, NextAuth-allowed public route, `vaidix-csrf` cookie) | M | ✅ | Frontend SPA must read `/api/csrf` and echo `x-csrf-token` on mutations |
| 16 | Retention sweep worker (`src/server/workers/retention-worker.ts`) + 9 default policies seeded in migration `20260425180000_retention_policy`; daily 03:00 cron via BullMQ repeatable job | M | ✅ | None |
| 17 | DPDPA: `POST /api/me/data-export`, `POST /api/me/erasure-request`, admin `POST /api/admin/dpdpa/[id]/decide`, `dsr-export-worker` + `erasure-worker`, [COMPLIANCE-DPDPA.md](COMPLIANCE-DPDPA.md) | L | ✅ | **Legal review of `COMPLIANCE-DPDPA.md` consent wording + 30-day SLA** |
| 18 | `tests/e2e/security.spec.ts` — fail-closed rate limit, passwordVersion revocation, CSRF (missing + mismatch), IDOR, RBAC, share-link plaintext rejected, health/ready public + structured | M | ✅ | None |
| 19 | LiveKit 100-user load test (`tests/load/livekit-100.ts`) + [LOAD-TEST-RESULTS.md](LOAD-TEST-RESULTS.md) | M | ✅ | **Operator runs the test on real LVPEI hardware, fills the results table, tunes `livekit.yaml`** |
| 20 | PHI scanner extensions: EXIF/metadata strip (`src/server/services/phi/exif-strip.ts`) for JPEG/PNG; Presidio sidecar plan in [PHI-ROADMAP.md](PHI-ROADMAP.md) | M | ✅ | None |
| 21 | Operator runbooks — DEPLOY, FIRST-DAY, INCIDENT, SECRET-ROTATE, CERT-ROTATE, BACKUP, PG-FAILOVER all shipped | M | ✅ | None |

---

## Definition of done (whole sprint)

1. All 21 items marked ✅ in this file.
2. `npm run e2e:w1 && e2e:w2 && e2e:w4 && e2e:w5 && e2e:w6` still pass.
3. New `tests/e2e/security.spec.ts` Playwright pack passes (item #18).
4. A clean Linux host can come up to "serving traffic over TLS" using only the runbooks.
5. A timed restore drill (item #5) recovers yesterday's state in < 30 min.
6. A LVPEI infosec / Codex review of this file + the runbooks finds no open CRITICAL items.

---

## Out of scope (deferred — recorded so they don't get reintroduced)

| Item | Reason |
|---|---|
| 2FA for ADMIN/PD | Explicit operator call. Residual risk: stolen ADMIN cookie within 8h JWT TTL grants full access; no second factor. Re-introduce via `otplib` + `userTotpSecret` if compliance mandate appears. |
| Real Microsoft Presidio sidecar | Phase 2. Phase 1 stopgap is the regex scanner + NER name detection (item #20). |
| LiveKit multi-node clustering | Phase 2 / paid tier. Phase 1 accepts single-node with fast-restart runbook. |
| Sentry / DataDog APM | Item #7 lays the groundwork (structured logs); paid tooling is a Phase 2 budget call. |
