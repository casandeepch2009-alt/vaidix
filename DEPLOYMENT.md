# Vaidix — AWS Deployment Guide

This document covers how the Vaidix platform is deployed on AWS, the day-2 operational procedures, and how to recover from common failures. It's the source of truth for **how to keep the production environment running**.

Codebase changes belong in code + commit messages. This file is for *operational* knowledge.

---

## 1. What's running and where

**Architecture (single-host v1)**

```
                          Internet
                              │
                              ▼
                ┌────────────────────────┐
                │ AWS EC2 (ap-south-1)   │
                │ Ubuntu 22.04 LTS       │
                │ Elastic IP: 13.234.37.54│
                │                        │
                │  ┌─ nginx ─────────┐   │
                │  │ TLS termination │   │
                │  │ proxy → app:3000│   │
                │  └─────────────────┘   │
                │      │                 │
                │      ▼                 │
                │  ┌─ app (Next.js) ─┐   │
                │  │  vaidix-app     │   │
                │  └─────────────────┘   │
                │      │       │         │
                │      ▼       ▼         │       ┌────────────────────────┐
                │  ┌─ workers ┐ ┌─ livekit ──────────► coturn (UDP NAT)   │
                │  │ (BullMQ) │ │ (WebRTC SFU)    │   │ port 3478 / 5349  │
                │  └──────────┘ └──────────────┐   │   └────────────────────┘
                │       │              │         │
                │       ▼              ▼         │
                │  ┌─ redis ┐  ┌─ livekit-egress ┐│
                │  │ queue  │  │ (recording)     ││
                │  └────────┘  └─────────────────┘│
                │       │                         │
                │       ▼                         │
                │  ┌─ minio (S3-compat) ────────┐ │
                │  │ recordings + uploads        │ │
                │  └─────────────────────────────┘ │
                └──────────────────────────────────┘
                              │
                              ▼
                ┌───────────────────────────────────┐
                │ AWS RDS Postgres 16 (ap-south-1)  │
                │ vaidix-db.cvoegysq84x4.            │
                │   ap-south-1.rds.amazonaws.com    │
                │ SSL required                       │
                └───────────────────────────────────┘
```

**Docker Compose split** — each tier is a separate compose file so they can be restarted independently:

| Compose file | Services | Restart impact |
|---|---|---|
| `docker-compose.prod.yml` | app, workers, nginx, livekit, livekit-egress, coturn | App/UI downtime |
| `docker-compose.redis.yml` | redis | Sessions + queue paused (~5s) |
| `docker-compose.minio.yml` | minio | Upload/recording playback paused |
| ~~`docker-compose.postgres.yml`~~ | (unused — we're on RDS) | n/a |

All four compose files attach to a shared external bridge network: `vaidix-net`.

---

## 2. AWS resources

### EC2 instance

| Property | Value |
|---|---|
| Region | `ap-south-1` (Mumbai) |
| Hostname | `ip-172-31-46-126` |
| Public IP (Elastic) | `13.234.37.54` |
| OS | Ubuntu 22.04 LTS |
| Instance type | **TODO** — run on EC2: `curl -s http://169.254.169.254/latest/meta-data/instance-type` |
| EBS root volume | 28 GB gp3 (`/dev/root`) |
| User | `ubuntu` |

### RDS database

| Property | Value |
|---|---|
| Engine | Postgres 16 |
| Endpoint | `vaidix-db.cvoegysq84x4.ap-south-1.rds.amazonaws.com:5432` |
| Database | `vaidix` |
| User | `vaidix` |
| Connection | SSL required (`sslmode=require`) |
| Instance class | **TODO** — AWS Console → RDS → vaidix-db → Configuration |
| Multi-AZ | **TODO** — recommended for production; check Configuration |
| Automated backups | **TODO** — check Maintenance & backups tab (recommend 7-day retention min) |
| Auto-rotation | **DISABLED** (intentional — the app reads from `.env`, not Secrets Manager) |

### Security group (inbound rules)

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | your-IP/32 | SSH (restricted) |
| 80 | TCP | 0.0.0.0/0 | HTTP → 443 redirect + ACME challenge |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 7881 | TCP | 0.0.0.0/0 | LiveKit TCP signalling/fallback |
| 7882 | UDP | 0.0.0.0/0 | LiveKit RTC UDP |
| 50000-50100 | UDP | 0.0.0.0/0 | LiveKit media port range |
| 3478 | UDP | 0.0.0.0/0 | coturn STUN/TURN |
| 5349 | TCP/UDP | 0.0.0.0/0 | coturn TURNS (TLS) |

**Egress**: allow all (default).

### DNS records (GoDaddy)

| Hostname | Type | Value |
|---|---|---|
| `vaidix.arthivaa.com` | A | `13.234.37.54` |
| `livekit.vaidix.arthivaa.com` | A | `13.234.37.54` |
| `s3.vaidix.arthivaa.com` | A | `13.234.37.54` |

All three must point to the same Elastic IP (the deploy script verifies this before issuing TLS certs).

### TLS certificates

- **Provider**: Let's Encrypt (via certbot in `--standalone` mode)
- **Stored at**: `/etc/letsencrypt/live/vaidix.arthivaa.com/` (the other two hostnames are symlinks to this directory)
- **Renewal**: Weekly cron at `0 3 * * 1` (`/etc/cron.d/vaidix-cert-renew`). Pre-hook stops nginx, post-hook starts it.

---

## 3. First-time deployment (from zero)

**You should only do this when bringing up a new EC2 box from scratch.** For everyday code deploys, skip to Section 4.

### 3.1 Provision the EC2 instance

1. Launch Ubuntu 22.04 LTS in `ap-south-1`, instance type **t3.large** or better (2 vCPU / 8GB RAM minimum).
2. Attach a 100 GB gp3 EBS volume.
3. Allocate an Elastic IP and associate it.
4. Configure the security group per Section 2.

### 3.2 Set up DNS

Add the three A records in Section 2 to GoDaddy. Wait for propagation:

```bash
dig +short vaidix.arthivaa.com @1.1.1.1
dig +short livekit.vaidix.arthivaa.com @1.1.1.1
dig +short s3.vaidix.arthivaa.com @1.1.1.1
```

All three must return the Elastic IP.

### 3.3 SSH in and install dependencies

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<elastic-ip>

sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates gnupg gettext-base dnsutils certbot

# Docker (official repo)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker ubuntu && newgrp docker

# Verify
docker --version && docker compose version
```

### 3.4 Provision RDS (if not already running)

In AWS Console → RDS → Create database:
- Engine: Postgres 16
- Template: Production
- Instance class: **db.t3.medium** minimum
- Storage: 100 GB gp3, autoscaling to 500 GB
- Multi-AZ: enabled (recommended)
- Initial DB name: `vaidix`
- Master username: `vaidix`
- Master password: strong random — save to password manager
- VPC: same as EC2
- Security group: allow inbound 5432 from EC2's SG (or VPC CIDR)
- Public access: **No**
- Automated backups: 7-day retention
- Encryption: enabled

Wait for status `Available` (5-10 min), copy the endpoint.

### 3.5 Clone the repo

```bash
cd ~
git clone https://github.com/casandeepch2009-alt/vaidix.git
cd vaidix
git log -1 --oneline
```

If repo is private, use a deploy key or PAT.

### 3.6 Build the `.env` file

```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

Fill in the values per [.env.production.example](.env.production.example). Critical ones:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://vaidix:<pwd>@<rds-endpoint>:5432/vaidix?sslmode=require&schema=public&connection_limit=30&pool_timeout=20` |
| `REDIS_PASSWORD` | `openssl rand -base64 24 \| tr -d '=+/'` — alphanumeric only |
| `REDIS_URL` | `redis://:<REDIS_PASSWORD>@redis:6379` |
| `NEXTAUTH_URL` | **MUST** match the public domain: `https://vaidix.arthivaa.com` |
| `NEXTAUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` | **Real email** for the bootstrap admin (used for password reset) |
| `ADMIN_MOBILE` | `+91XXXXXXXXXX` |
| `ADMIN_PASSWORD` | `openssl rand -base64 18` — save securely |
| `LIVEKIT_URL` | `wss://livekit.vaidix.arthivaa.com` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Random strong values; same values configured in `livekit.yaml` |
| `S3_*` | If using bundled MinIO: keep `http://minio:9000`, set strong access/secret |
| `GEMINI_API_KEY` | From Google AI Studio |

### 3.7 Bring up data tier + render configs

```bash
docker network create vaidix-net

chmod +x scripts/render-configs.sh && ./scripts/render-configs.sh

docker compose -f docker-compose.redis.yml --env-file .env up -d
docker compose -f docker-compose.minio.yml --env-file .env up -d

# Confirm
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'vaidix-(redis|minio)'
```

### 3.8 Build app image, migrate, seed

```bash
docker compose -f docker-compose.prod.yml --env-file .env build app

# CRITICAL: apply migrations FIRST (idempotent, but required before app starts)
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy

# Plant the bootstrap admin (reads ADMIN_* from .env)
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma db seed
```

The seed log should end with:
```
🛡️  PRODUCTION seed: only admin (<your-email>) was created.
```

### 3.9 Issue TLS certificates + bring up the rest

```bash
sudo apt install -y certbot

# Stop nginx if running
docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Issue cert for all 3 hostnames
sudo certbot certonly --standalone --non-interactive --agree-tos --keep-until-expiring \
  --email <your-real-email> \
  -d vaidix.arthivaa.com \
  -d livekit.vaidix.arthivaa.com \
  -d s3.vaidix.arthivaa.com

# Symlink the dirs (cert is stored under the first -d only)
sudo ln -sfn /etc/letsencrypt/live/vaidix.arthivaa.com /etc/letsencrypt/live/livekit.vaidix.arthivaa.com
sudo ln -sfn /etc/letsencrypt/live/vaidix.arthivaa.com /etc/letsencrypt/live/s3.vaidix.arthivaa.com

# Replace placeholder hostnames in nginx configs
sudo sed -i.bak 's|app\.vaidix\.lvpei\.org|vaidix.arthivaa.com|g'              nginx/sites-enabled/app.conf
sudo sed -i.bak 's|livekit\.vaidix\.lvpei\.org|livekit.vaidix.arthivaa.com|g'  nginx/sites-enabled/livekit.conf
sudo sed -i.bak 's|s3\.vaidix\.lvpei\.org|s3.vaidix.arthivaa.com|g'            nginx/sites-enabled/s3.conf

# Bring everything up
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Install weekly cert renewal cron
echo "0 3 * * 1 root cd /home/ubuntu/vaidix && certbot renew --quiet --pre-hook 'docker compose -f /home/ubuntu/vaidix/docker-compose.prod.yml stop nginx' --post-hook 'docker compose -f /home/ubuntu/vaidix/docker-compose.prod.yml start nginx'" | sudo tee /etc/cron.d/vaidix-cert-renew
sudo chmod 644 /etc/cron.d/vaidix-cert-renew
```

### 3.10 Verify

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep vaidix
curl -fsS https://vaidix.arthivaa.com/api/health
```

Expect all containers `(healthy)` and `{"ok":true,"service":"vaidix",...}`. Browse to `https://vaidix.arthivaa.com` → green padlock → login screen.

Login with `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`. From `/admin/invitations`, invite other users.

---

## 4. Routine code deploy

**The default flow. Use this every time you push code to master.**

### On laptop

```bash
cd <repo>
# make changes, commit
git push origin master
```

### On EC2

```bash
ssh ubuntu@13.234.37.54
cd ~/vaidix

git fetch origin
git log HEAD..origin/master --oneline  # sanity check what's incoming

git pull origin master

# Build NEW image. CRITICAL: must succeed before running migrations.
docker compose -f docker-compose.prod.yml --env-file .env build app

# Apply any pending migrations. Idempotent; safe to always run.
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy

# Restart app + workers + nginx (nginx is needed to clear DNS cache for the new container)
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app workers nginx

# Verify
sleep 30
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'vaidix-(app|nginx|workers)'
curl -fsS https://vaidix.arthivaa.com/api/health && echo " ← LIVE"
docker logs vaidix-app --tail 30 | grep -iE "error|ready"
```

**Why each step matters:**

| Step | Why |
|---|---|
| `git fetch` + `log` before `pull` | Shows what's about to change, so you can spot something unexpected |
| `build` before `migrate deploy` | The migrations live in the image. If the build hasn't completed, the one-shot container uses the old image's migration set. |
| `migrate deploy` before app restart | App will crash on first request if schema is missing columns (P2022 error) |
| `--force-recreate ... nginx` | Without restarting nginx, it keeps the old container's IP cached → 502 errors |

### Schema changes (Prisma)

If your commit includes schema changes:

1. **On laptop**: ALWAYS run `npx prisma migrate dev --name "describe_change"` to generate a migration file. Commit the migration file together with your schema change.
2. **On EC2**: `git pull` brings the new migration file. `prisma migrate deploy` applies it to RDS.

Never edit `prisma/schema.prisma` without generating a migration. The schema-vs-DB drift that causes runtime errors (`P2022: column does not exist`) is always due to skipped migrations.

---

## 5. Day-2 operations

### 5.1 Tail logs

```bash
# App
docker logs -f vaidix-app --tail 50

# Worker (background jobs)
docker logs -f vaidix-workers --tail 50

# Any container
docker logs -f vaidix-<name> --tail 50

# Recent errors across all vaidix containers
for c in $(docker ps --format '{{.Names}}' | grep vaidix); do echo "=== $c ==="; docker logs $c --tail 20 2>&1 | grep -iE "error|fail|exception" | tail -5; done
```

### 5.2 Restart a single service (no downtime if app is multi-replica; ~10s otherwise)

```bash
docker compose -f docker-compose.prod.yml --env-file .env restart <name>
```

### 5.3 Disk cleanup

Free reclaimable Docker space (safe — does not touch running containers or named volumes):

```bash
df -h / && docker system df
docker system prune -af && docker builder prune -af
df -h /
```

Target: keep `/` under 70% used. The build process needs ~10 GB of headroom or it'll fail in the "exporting to image" step.

### 5.4 Certificate renewal

**Automatic**: the cron at `/etc/cron.d/vaidix-cert-renew` runs every Monday at 3 AM. Pre-hook stops nginx (frees port 80 for ACME), post-hook restarts it.

**Manual renewal** (if cron failed):

```bash
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot renew --quiet
docker compose -f docker-compose.prod.yml start nginx
```

**Check expiry**:

```bash
sudo certbot certificates
```

### 5.5 Backups

**RDS** — automated daily snapshots, retained 7 days (configure in AWS Console). To restore: AWS Console → RDS → Snapshots → Restore.

**MinIO recordings** — stored in named volume `vaidix-recordings`. To back up:

```bash
docker run --rm -v vaidix-recordings:/data -v $(pwd):/backup alpine \
  tar czf /backup/recordings-$(date +%Y%m%d).tar.gz -C /data .
```

Push to S3 or download to a safe location.

**EBS snapshots** — schedule via AWS Backup or DLM (Data Lifecycle Manager). Recommended: daily, 7-day retention.

### 5.6 Health checks

| Check | Command | Expected |
|---|---|---|
| All containers | `docker ps --format 'table {{.Names}}\t{{.Status}}' \| grep vaidix` | All `(healthy)` or `Up X days` |
| App health (via nginx) | `curl -fsS https://vaidix.arthivaa.com/api/health` | `{"ok":true,...}` |
| Redis | `docker exec vaidix-redis redis-cli -a "$REDIS_PASSWORD" ping` | `PONG` |
| RDS reachable from EC2 | `docker exec vaidix-app sh -c 'npx prisma migrate status'` | "Database schema is up to date" |
| LiveKit | `curl -fsS -o /dev/null -w "%{http_code}\n" https://livekit.vaidix.arthivaa.com/` | `200` |
| Disk free | `df -h /` | Used < 70% |

---

## 6. Troubleshooting

### Cert is "not trusted" in browser (`NET::ERR_CERT_AUTHORITY_INVALID`)

**Cause**: nginx is serving a cert for the wrong hostname (usually the placeholder `app.vaidix.lvpei.org`) or a self-signed cert.

**Fix**:
1. Verify DNS: `dig +short vaidix.arthivaa.com @1.1.1.1` returns the Elastic IP.
2. Re-run certbot for the real hostnames (see Section 3.9).
3. Restart nginx: `docker compose -f docker-compose.prod.yml restart nginx`.

### 502 Bad Gateway after app restart

**Cause**: nginx cached the old app container's IP. The new container has a different internal IP.

**Fix**: `docker compose -f docker-compose.prod.yml --env-file .env restart nginx`. Always include `nginx` in `--force-recreate` lists during deploys.

### Dashboard / API throws P2022 ("column does not exist")

**Cause**: prisma client (in the image) is ahead of the RDS schema. A migration was skipped.

**Fix**:
```bash
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate status
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app workers nginx
```

**Prevention**: always `build → migrate deploy → restart`, in that order.

### App container `(unhealthy)` but `/api/health` returns 200 via curl

**Cause**: healthcheck command not present in the runtime image. Currently we use `curl` (was `wget` originally, fixed).

**Fix**: check `docker-compose.prod.yml` healthcheck blocks — must use `curl`, not `wget`. The runtime image installs `curl`, `ffmpeg`, `openssl`, `tini` — no `wget`.

### Build fails at "exporting to image"

**Cause**: disk full. Docker can't write the final layers.

**Fix**:
```bash
docker system prune -af
docker builder prune -af
df -h /
```

If still full after prune: increase EBS volume size in AWS Console → reboot EC2.

### App container restarts continuously

**Cause**: bad env var, missing config, DB unreachable.

**Fix**:
```bash
docker logs vaidix-app --tail 100 | grep -iE "error|fail"
```

Common offenders:
- `DATABASE_URL` wrong / RDS SG blocking EC2 SG
- `NEXTAUTH_SECRET` empty or changed (logs everyone out, sometimes causes boot loop)
- New env var required by pulled code but not in `.env`

### Login works but cookies / CSRF fail

**Cause**: `NEXTAUTH_URL` doesn't match the URL the user is browsing.

**Fix**: in `.env`, `NEXTAUTH_URL="https://vaidix.arthivaa.com"` (exact match, no trailing slash). Restart app.

### LiveKit video room won't connect

**Cause** usually one of:
1. UDP 7882 / 50000-50100 blocked at the security group
2. coturn not running
3. `LIVEKIT_URL` in `.env` doesn't match the actual WSS endpoint

**Fix**:
```bash
sudo ss -tunlp | grep -E ':(7881|7882|3478)'
docker logs vaidix-livekit --tail 50
docker logs vaidix-coturn --tail 30
```

### Out of memory

Symptom: app gets OOM-killed (`docker logs vaidix-app` shows the process dying without a trace).

**Fix**: bump EC2 instance size in AWS Console → reboot. The default 8GB is OK for early use; under load consider t3.xlarge or m6i.large.

---

## 7. Emergency recovery

### 7.1 EC2 box dies

If the EBS volume is intact (most cases):

1. Stop the failed instance, detach its EBS volume.
2. Launch a new instance, same AMI + size.
3. Attach the old EBS volume as the root device.
4. Reassociate the Elastic IP.
5. Boot. Application should come back automatically (`restart: unless-stopped` on all containers).

If the EBS volume is also gone:

1. Restore from the latest EBS snapshot.
2. Same as above, OR re-do the first-time deploy (Section 3) and restore RDS from a snapshot.

### 7.2 RDS dies / corruption

1. In AWS Console → RDS → Snapshots, find the latest automated snapshot.
2. **Restore snapshot** → new instance with same VPC/SG settings.
3. Once available, update `DATABASE_URL` in `~/vaidix/.env` to point at the new endpoint.
4. Restart app: `docker compose -f docker-compose.prod.yml --env-file .env restart app workers`.
5. Decommission the old instance.

**RPO**: 24 hours (daily snapshots). For lower RPO, enable point-in-time recovery in RDS.

### 7.3 Lost admin password

The bootstrap admin can be reset by re-running the seed with a new `ADMIN_PASSWORD`:

```bash
# Edit .env, set ADMIN_PASSWORD to a new strong value
# Then:
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma db seed
```

The seed upserts the admin row; the new hash overwrites the old. Other users are untouched.

### 7.4 Full rebuild from scratch

If everything is hosed and you need to start fresh:

1. Take a final RDS snapshot (or accept the existing one).
2. Provision new EC2 + RDS as per Section 3.
3. Restore RDS from the snapshot.
4. Do the rest of Section 3 (clone repo, fill `.env` with the **restored** RDS endpoint, etc.).
5. **Skip** `prisma db seed` if the restored DB already has data (re-running seed is idempotent but unnecessary).

---

## 8. Repository operational files

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` | Production stack (app, workers, nginx, livekit, egress, coturn) |
| `docker-compose.redis.yml` | Standalone Redis stack |
| `docker-compose.minio.yml` | Standalone MinIO stack |
| `docker-compose.postgres.yml` | Standalone Postgres — NOT used in current deploy (RDS instead) |
| `nginx/nginx.conf` | nginx base config (TLS, headers, gzip) |
| `nginx/sites-enabled/*.conf` | Per-vhost configs — these are sed-edited at deploy time with real hostnames |
| `livekit.yaml` | LiveKit server config |
| `egress.yaml.tpl` | Egress config template — rendered to `egress.yaml` by `scripts/render-configs.sh` |
| `turnserver.conf` | coturn config |
| `Dockerfile` | App image (Node 20, multi-stage build) |
| `prisma/schema.prisma` | DB schema — source of truth for ORM |
| `prisma/migrations/` | Generated SQL migrations — committed to git |
| `prisma/seed.ts` | Bootstrap seed (admin + structural data only in prod) |
| `.env.production.example` | Template — copy to `.env` and fill |

---

## 9. Open hardening items (defer until after stable v1)

1. **Move TLS-terminating nginx to ALB** + reserve Multi-AZ readiness.
2. **RDS Multi-AZ** (currently TODO — check status).
3. **CloudWatch alarms** for: high CPU, low disk, RDS connections, app 5xx rate.
4. **EBS snapshot schedule** via AWS Backup (daily, 7-day retention).
5. **Sealed env**: switch from plaintext `.env` to age-encrypted `vaidix.env.enc` decrypted by `scripts/load-env.sh` at deploy time.
6. **Backup MinIO recordings to S3** on a weekly schedule.
7. **`scripts/deploy.sh`** — one-shot `git pull → build → migrate → restart` with safety checks (already partially planned).
8. **Rotate `sandeep@vaidix.local`** out of seed entirely; bootstrap should be one-time-only and disable itself after first invite.
9. **Stronger RDS master password** (current is short; recommend 24+ chars).

---

**Last updated**: 2026-05-11
**Maintainer**: Sandeep (`casandeepch2009@gmail.com`)
