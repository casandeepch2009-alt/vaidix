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

### 3.11 First-deploy gotchas — verify these before you hand the URL to users

These are the things that broke a real prod deploy on 2026-05-13. The site
loaded, the user could log in, but every video call failed with "Connection
trouble". Each item below is a hidden landmine that doesn't surface until
someone tries to use the platform end-to-end. Walk this checklist after
§3.10 passes.

**`.env` placeholders that survived the copy** — `.env` is per-host and
gitignored, so the example file's defaults won't be flagged by any review.
Verify EVERY value below is real, not the example placeholder:

| Variable | Common wrong value | Right value | Symptom if wrong |
|---|---|---|---|
| `NEXTAUTH_URL` | `http://13.234.37.54:3000` or `http://localhost:3000` | `https://vaidix.arthivaa.com` (your real domain, HTTPS) | Login appears to work, then redirects loop or cookies refuse to set |
| `LIVEKIT_URL` | `wss://13.234.37.54/livekit` (raw IP) | `wss://livekit.vaidix.arthivaa.com` (subdomain) | Browser console: `ERR_CERT_COMMON_NAME_INVALID` on the rtc validate request |
| `LIVEKIT_API_KEY` | `CHANGE_ME_LIVEKIT_KEY` (placeholder text) | A real key that matches `livekit.prod.yaml` `keys:` block | Browser console: `invalid API key: CHANGE_ME_LIVEKIT_KEY` → 401 |
| `LIVEKIT_API_SECRET` | `CHANGE_ME_LIVEKIT_SECRET_MIN_32_CHARS` | A real 32+ char secret matching `livekit.prod.yaml` | Same as above, or token signing fails silently |
| `EMAIL_PASSWORD` | `YOUR_16_CHAR_GMAIL_APP_PASSWORD` | A real Gmail app password (or switch to SES, see §9) | Invitations land in DB but no email is sent; audit_events shows `invitation.sent success=false` |

The fastest way to verify is to `grep -E "CHANGE_ME|YOUR_|placeholder|example|13\.234" .env` —
if anything matches, that's a placeholder you forgot. The grep should
return zero lines on a properly configured host.

**Security group missing UDP rules** — the AWS launch-wizard default opens
only TCP 22/80/443. Without explicit UDP rules every WebRTC packet from
clients is dropped at the firewall, ICE negotiation times out, and the
live classroom shows "Connection trouble" even though the WebSocket
signal connection works fine. Verify the SG inbound rules table in §2
matches your actual SG — pay attention to the UDP rows specifically:
7882, 50000-50100, 3478. This bit twice on the same deploy; check it
even if you "remember setting it last time."

**Prod compose mounts the right LiveKit yaml** — `docker-compose.prod.yml`
must mount `./livekit.prod.yaml` (not `./livekit.yaml`). The dev yaml
hardcodes a developer-laptop LAN IP in `node_ip` that LiveKit then
advertises to browsers in ICE candidates; the browser tries to send
media to that private IP and silently fails. Confirm with:
`grep livekit docker-compose.prod.yml | grep yaml` — should show
`./livekit.prod.yaml:/etc/livekit.yaml:ro`.

**One-line sanity sweep** — run from the EC2 host once the stack is up
and you've signed in. Should print all OKs:

```bash
# .env hygiene
grep -qE "CHANGE_ME|YOUR_|placeholder" .env && echo "FAIL: .env still has placeholders" || echo "OK: .env clean"

# LiveKit advertises public IP, not private
docker logs vaidix-livekit --tail 50 2>&1 | grep -q "nodeIP.*192\.168\." && echo "FAIL: livekit nodeIP is private" || echo "OK: livekit nodeIP looks right"

# Right yaml is mounted in prod compose
grep -q "livekit.prod.yaml" docker-compose.prod.yml && echo "OK: prod yaml mounted" || echo "FAIL: prod compose uses dev livekit.yaml"

# WS upgrade reaches LiveKit (should be 401, not 404)
code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --max-time 5 https://livekit.$(cat .deployed-domain 2>/dev/null || echo "vaidix.arthivaa.com")/rtc)
[ "$code" = "401" ] && echo "OK: WS upgrade reaches LiveKit (401)" || echo "FAIL: WS upgrade returns $code (want 401)"
```

If any line prints FAIL, fix that before announcing the URL.

---

## 4. Routine code deploy

**The default flow. Use this every time you push code to master.**

### On laptop

```bash
cd <repo>
# make changes, commit
git push origin master
```

### On EC2 — one command (since v2.7)

```bash
ssh ubuntu@13.234.37.54
cd ~/vaidix

./scripts/deploy.sh
```

That's it. The script is idempotent, change-aware, and uses the **correct compose service names** (`app`, `livekit`, `coturn`, `livekit-egress`, `nginx`) — not the container names (`vaidix-app`, `vaidix-livekit`, ...) that previously caused silent no-ops when operators reached for what they saw in `docker ps`.

**What `deploy.sh` does, in order:**

1. **Stash local nginx hostname edits** so `git pull` never conflicts on `nginx/sites-enabled/`.
2. **Pull from origin/master** and compute the set of changed files.
3. **Render templated configs from `.env`** via `scripts/render-configs.sh` — refuses to render if any required env var is empty or still contains the literal `CHANGE_ME` placeholder. Templates: `egress.yaml.tpl`, `turnserver.conf.tpl`, `livekit.prod.yaml.tpl`.
4. **Apply pending Prisma migrations** (`migrate deploy` — idempotent, additive-only).
5. **Rebuild + recreate `app`** ONLY when `src/`, `prisma/`, `package.json`, `next.config.ts`, or `Dockerfile` changed.
6. **Recreate `livekit` + `coturn`** when `livekit.prod.yaml.tpl`, `turnserver.conf.tpl`, or `scripts/render-configs.sh` changed.
7. **Recreate `livekit-egress`** when `egress.yaml.tpl` changed.
8. **Reload `nginx`** when anything under `nginx/` changed.
9. **Health check** — surface app boot logs + LiveKit ICE/TURN advertisement.

**Why this matters (history of incidents prevented):**

| Incident class | Pre-v2.7 cause | Prevented by |
|---|---|---|
| "v2.6 deck fix never deployed" | Operator typed `vaidix-app` (container name) instead of `app` (service name); compose silently no-op'd | `deploy.sh` uses service names |
| "Guest's name keeps refreshing" (v2.4) | `turnserver.conf` hardcoded `CHANGE_ME_STRONG_TURN_PASSWORD` placeholder; operator runbook said "remember to sed it", they didn't | Tracked file removed; `.tpl` substitutes from `.env`; render refuses on placeholder |
| "Egress storm" (v2.4) | `egress.yaml.tpl` had `ws://192.168.1.7:7880` LAN IP shipping unchanged to prod | Same envsubst + validation pattern |
| "Forgot to rebuild after schema change" | Operator pulled, restarted, forgot `--no-cache build` | `deploy.sh` step 5 always rebuilds on `src/` or `prisma/` change |

### Schema changes (Prisma)

If your commit includes schema changes:

1. **On laptop**: ALWAYS run `npx prisma migrate dev --name "describe_change"` to generate a migration file. Commit the migration file together with your schema change.
2. **On EC2**: `./scripts/deploy.sh` applies it automatically via step 4.

Never edit `prisma/schema.prisma` without generating a migration. The schema-vs-DB drift that causes runtime errors (`P2022: column does not exist`) is always due to skipped migrations.

### Rotating secrets (TURN password, LiveKit keys, DB password)

`deploy.sh` reads `.env`. To rotate any secret without disturbing other entries:

```bash
# Idempotent upsert (preserves comments, blank lines, all other keys):
upsert_env() {
  local key="$1" value="$2" file="${3:-.env}"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    [ -s "$file" ] && [ "$(tail -c 1 "$file")" != "" ] && echo "" >> "$file"
    echo "${key}=${value}" >> "$file"
  fi
}

# Example: rotate the TURN secret
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
upsert_env TURN_SHARED_SECRET "$(openssl rand -base64 24 | tr -d '+/=' | head -c 32)"

# Re-render configs + restart only the affected containers:
./scripts/render-configs.sh
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate livekit coturn
```

The rendered `turnserver.conf` and `livekit.prod.yaml` are `.gitignore`d — they are deploy artifacts, not source. Editing them by hand on the box creates drift that the next `deploy.sh` will silently overwrite. Always edit `.env` instead, then re-render.

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

The signal connection (WebSocket over 443) works but the call shows
"Connection trouble" or stays at "Connecting…" forever. There are four
layers to check in order — fix the first one that doesn't pass.

1. **Security group missing UDP rules.** AWS launches with a default SG that
   only opens 22/80/443. Without the LiveKit + coturn UDP rules, every
   STUN binding request from the browser is dropped at the firewall, ICE
   negotiation times out. Verify the table in §2 lines up with your real
   SG inbound rules — specifically UDP 7882, 50000-50100, 3478, and TCP 7881/5349.
2. **`LIVEKIT_URL` in `.env` points at the wrong host.** Must be the public
   domain (e.g. `wss://livekit.vaidix.arthivaa.com`), not the EC2 IP or a
   dev placeholder. The app returns this URL to the client at token-mint
   time, so the browser will dial whatever you've put here.
3. **`livekit.yaml` advertising a private IP in ICE candidates.** If
   LiveKit logs show `[local][trickle] udp4 host 192.168.x.x:50044`
   instead of the EC2 public IP, the wrong yaml is mounted. Prod must
   use `livekit.prod.yaml` (use_external_ip:true). docker-compose.prod.yml
   should have `./livekit.prod.yaml:/etc/livekit.yaml:ro`, NOT `livekit.yaml`.
4. **nginx HTTP/2 stripping the WebSocket upgrade.** Browser console shows
   `wss://livekit.../rtc` returning 404 even though `/` returns 200. nginx
   advertises h2 per-listener, not per-server, so `http2 on;` on any 443
   vhost forces h2 on the entire port and breaks the legacy WS upgrade
   that LiveKit needs. All 443 vhosts must keep `http2 on;` commented out.

Diagnostics in priority order:

```bash
# (a) Real ICE candidate IPs LiveKit is advertising — should be the public IP
docker logs vaidix-livekit --tail 200 2>&1 | grep "local\]\[trickle\]" | tail -5

# (b) End-to-end WS upgrade — must return 401, not 404. 401 means LiveKit
#     received the upgrade and asked for a token. 404 means nginx is breaking
#     the upgrade (probably http2) or the wrong yaml is mounted.
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  --max-time 5 https://livekit.<your-domain>/rtc

# (c) Browser console — open DevTools while joining. ICE candidates listed
#     in the NegotiationError log entry must contain the EC2 public IP. If
#     all local candidates are 192.168.x.x, layer (3) above is the issue.
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
