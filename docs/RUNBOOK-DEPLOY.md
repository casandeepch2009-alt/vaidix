# RUNBOOK — Deploy / Rollback

**Audience:** LVPEI on-prem operator. **Time:** ≤ 30 min for a clean release.

## Pre-flight

- Target host: Ubuntu 22.04 LTS, x86_64, ≥ 8 cores, ≥ 32 GB RAM, ≥ 1 TB disk on `/var`.
- DNS resolves: `app.vaidix.lvpei.org`, `livekit.vaidix.lvpei.org`, `s3.vaidix.lvpei.org` → host IP.
- Firewall opens: 80, 443, 7881/tcp, 7882/udp, 50000-50100/udp, 3478/udp + 5349/tcp (TURN).
- `/etc/vaidix/age.key` exists, root-owned, mode 0600 (see [RUNBOOK-SECRET-ROTATE.md](RUNBOOK-SECRET-ROTATE.md)).
- Certs in `/etc/letsencrypt/live/<host>/fullchain.pem` + `privkey.pem` (see [RUNBOOK-CERT-ROTATE.md](RUNBOOK-CERT-ROTATE.md)).

## First-time install

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin age postgresql-client
sudo systemctl enable --now docker
git clone <repo-url> /opt/vaidix && cd /opt/vaidix
git checkout <release-tag>
./scripts/load-env.sh
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec app npx prisma db seed   # ONLY on a fresh DB
```

Verify `/api/ready` returns 200 with all four deps healthy. Then [RUNBOOK-FIRST-DAY.md](RUNBOOK-FIRST-DAY.md).

## Routine release

```bash
cd /opt/vaidix
git fetch --tags
git checkout <new-tag>
./scripts/load-env.sh
docker compose -f docker-compose.prod.yml --env-file .env build app workers
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app workers
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

Migrations are additive-only (HARDENING-PLAN convention). If the new release adds a column, the old container can keep running until the new one is healthy — no downtime expected.

## Rollback

```bash
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps app workers
```

If the bad release ran a destructive migration, restore from backup ([RUNBOOK-BACKUP.md](RUNBOOK-BACKUP.md)) — do **not** revert migrations by hand.

## Smoke checks after every release

| Check | Pass |
|---|---|
| `curl -fsS https://app.vaidix.lvpei.org/api/health` | `{"ok":true,...}` |
| `curl -fsS https://app.vaidix.lvpei.org/api/ready`  | `{"ok":true,"deps":[...all ok...]}` |
| `docker compose ps`                                   | every service `healthy` |
| `docker compose logs --since=5m \| grep -i error`     | no surprises |
| Sign in as `super-admin@lvpei.org`                    | dashboard renders |
| Start a test session, talk for 30 sec, end           | recording → READY in ≤ 5 min |
