# Running LiveKit natively on Windows (local dev)

## Why

Docker Desktop on Windows runs containers inside a WSL2 VM. WSL2 has a
separate network namespace from Windows. WebRTC media (UDP 50000–50100)
needs many round-trips between browser and server, and Docker Desktop's
port forwarder is unreliable for these UDP packets — typical symptom:
ICE times out after 10–15s, browser disconnects, you see "Could not
connect" repeatedly.

Running the LiveKit binary **natively on Windows** removes the WSL2 layer
entirely. The browser and LiveKit are on the same TCP/IP stack, so
localhost works as expected.

## One-time setup (5 min)

1. Stop the Docker LiveKit container so it doesn't fight for ports:
   ```powershell
   docker compose -f docker-compose.dev.yml stop livekit livekit-egress
   ```

2. Download the Windows binary from
   https://github.com/livekit/livekit/releases (latest `livekit_*_windows_amd64.zip`).
   Extract `livekit-server.exe` somewhere convenient — e.g. `C:\livekit\`.

3. Confirm Redis is still running in Docker (LiveKit needs it):
   ```powershell
   docker ps --filter name=vaidix-redis
   ```
   Should show "Up". Redis is exposed on `localhost:6379` so the native
   LiveKit can reach it.

## Run it

From the project root:

```powershell
C:\livekit\livekit-server.exe --config livekit.yaml
```

You should see:
```
starting LiveKit server  portHttp=7880  nodeIP=127.0.0.1  ...
```

Leave this terminal open while developing. Ctrl+C to stop.

## Test it works

In another terminal:
```bash
npx tsx --env-file=.env.local scripts/test-livekit-connect.ts
```
Or just refresh the classroom page in the browser and click Rejoin —
connection should establish in <2s and stay up.

## What to flip back for production

The `livekit.yaml` is fine as-is for the production Linux server (Docker
or native works there). Two things to change at deploy time:

1. `node_ip` → your server's public IP, or `use_external_ip: true`
2. Webhook URL → from `host.docker.internal:3000` to the real Next.js URL
3. The `keys:` section — replace the dev key/secret pair

## Why not fix Docker on Windows?

Tried and documented in commit history:
- `node_ip: 127.0.0.1` — fails because UDP port-forwarding from Windows
  to WSL2 is unreliable.
- `node_ip: <LAN-IP>` — same issue, packets don't reach the WSL2 VM.
- `network_mode: host` — LiveKit binds to all WSL2 interfaces and emits
  9+ candidates including unreachable WSL2-only IPv6 addresses, browser
  tries them all and times out.
- Docker Desktop's "Host Networking" experimental flag — only proxies
  TCP cleanly; UDP for ICE still misroutes.

This is a known sharp edge of Docker Desktop + WebRTC on Windows. On
Linux servers (production), Docker works perfectly for LiveKit. The
native-Windows-binary path is purely a local-dev workaround.
