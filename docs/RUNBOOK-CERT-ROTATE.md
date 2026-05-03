# RUNBOOK — TLS Certificate Rotation

HARDENING-PLAN.md item #2.

Three hostnames need TLS:

| Host | Used by |
|---|---|
| `app.vaidix.lvpei.org` | Browser → Next.js |
| `livekit.vaidix.lvpei.org` | Browser → LiveKit signalling (WSS) |
| `s3.vaidix.lvpei.org` | Browser → MinIO presigned URLs |

## Option A — Let's Encrypt (preferred when LVPEI allows ACME outbound)

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d app.vaidix.lvpei.org \
  -d livekit.vaidix.lvpei.org \
  -d s3.vaidix.lvpei.org
```

Certs land at `/etc/letsencrypt/live/<host>/`. The compose file mounts `/etc/letsencrypt` into nginx read-only.

Renewal cron (Let's Encrypt auto-renews at < 30 days remaining):

```cron
# /etc/cron.d/vaidix-tls
0 4 * * 1 root certbot renew --quiet --post-hook \
  "docker compose -f /opt/vaidix/docker-compose.prod.yml exec -T nginx nginx -s reload"
```

## Option B — LVPEI internal CA

If LVPEI mandates internal CA (no outbound to Let's Encrypt):

1. Submit a CSR for the three hostnames to LVPEI IT.
2. Place issued cert + key + CA chain at:
   ```
   /etc/letsencrypt/live/app.vaidix.lvpei.org/fullchain.pem
   /etc/letsencrypt/live/app.vaidix.lvpei.org/privkey.pem
   ```
   (same path for the other two hostnames; nginx config is path-stable).
3. Set a 30-day reminder before expiry to re-issue.
4. After install: `docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`.

## Verify

```bash
echo | openssl s_client -connect app.vaidix.lvpei.org:443 -servername app.vaidix.lvpei.org 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer
```

Expected: `notAfter` ≥ 60 days out, `subject` matches the host, `issuer` is your expected CA.

## Common issues

- **`SSL_ERROR_NO_CYPHER_OVERLAP`** — cert/key mismatch or wrong `ssl_certificate` path. Check `nginx -t`.
- **Egress recording fails after rotation** — egress doesn't talk to nginx; only the browser does. If you misedited `livekit.yaml` while rotating, egress will fail. Diff against the working version.
- **TURN doesn't pick up the new cert** — coturn reads the cert at startup. `docker compose restart coturn` after rotation.
