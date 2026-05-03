# RUNBOOK — Secret Rotation

HARDENING-PLAN.md item #3.

Rotate every secret at least every 90 days, immediately on suspected leak, and immediately on any operator role change (someone who had `/etc/vaidix/age.key` access leaves).

## Initial keypair (one-time, on the deploy host)

```bash
# 1. Generate the age keypair on the deploy host. The PRIVATE key never leaves.
sudo mkdir -p /etc/vaidix && sudo chmod 700 /etc/vaidix
sudo age-keygen -o /etc/vaidix/age.key
sudo chmod 600 /etc/vaidix/age.key
sudo chown root:root /etc/vaidix/age.key

# 2. Extract the public line and copy it into the repo.
sudo grep '^# public key:' /etc/vaidix/age.key | awk '{print $4}' > /tmp/age.pub
scp /tmp/age.pub <build-machine>:/path/to/vaidix/age.pub
```

Commit `age.pub` to the repo. **Never commit `age.key`.**

## Encrypting prod secrets

On a trusted build/admin machine:

```bash
cd /path/to/vaidix
cp .env.example .env.prod
# edit .env.prod with REAL production values
./scripts/seal-env.sh        # writes vaidix.env.enc
shred -u .env.prod
git add vaidix.env.enc age.pub && git commit -m "rotate prod secrets <date>"
```

`vaidix.env.enc` is safe to commit — only the holder of `/etc/vaidix/age.key` can decrypt.

## Loading on the deploy host

```bash
cd /opt/vaidix
git pull
./scripts/load-env.sh        # decrypts to ./.env (mode 0600)
docker compose -f docker-compose.prod.yml --env-file .env up -d
shred -u .env                # optional — only if you don't restart
```

## What to rotate per category

| Secret | Rotate via | Cascade impact |
|---|---|---|
| `NEXTAUTH_SECRET` | regenerate (`openssl rand -hex 32`) | All sessions invalidated; users re-login |
| `LIVEKIT_API_SECRET` + `LIVEKIT_API_KEY` | regenerate, update `livekit.yaml` `keys:` block, restart livekit + app | Active sessions disconnect once; rejoin works |
| `S3_SECRET_KEY` (MinIO root) | `mc admin user svcacct add` for app + workers; phase out the old root key | None if rolled in two steps |
| `EMAIL_PASSWORD` (Gmail App Password) | revoke via google account → generate new → reseal | Outbound email pauses ≤ 5 min |
| `SARVAM_API_KEY`, `GEMINI_API_KEY` | rotate in vendor portal → reseal | None |
| Database password | `ALTER USER vaidix WITH PASSWORD …` then reseal `DATABASE_URL` | App reconnects within seconds |
| `LIVE_CAPTIONS_INGEST_SECRET` | regenerate, redeploy LiveKit Agent sidecar with new value | Captions ingest pauses ≤ 30 s |

## End-to-end verification

```bash
docker compose -f docker-compose.prod.yml restart app workers
curl -fsS https://app.vaidix.lvpei.org/api/ready
docker compose exec app psql "$DATABASE_URL" -c "select 1"
docker compose exec app curl -sS http://localhost:3000/api/health
```

If `/api/ready` is green and a smoke session can be started, rotation is complete.

## Bump every active session (force everyone to re-login)

```bash
docker compose exec app psql "$DATABASE_URL" -c \
  "UPDATE users SET \"passwordVersion\" = \"passwordVersion\" + 1 WHERE status = 'ACTIVE';"
```

The HARDENING-PLAN #13 check picks this up within 30s for every authed request.
