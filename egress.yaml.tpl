# ════════════════════════════════════════════════════════════════════════════
# Vaidix — LiveKit Egress Config (server-side recording)
# ════════════════════════════════════════════════════════════════════════════
# Records rooms to MP4 files in /output (mapped to E:/vaidix-data/recordings/raw)
# Post-processing pipeline (BullMQ) picks up finished files for transcoding

api_key: devkey
api_secret: secret_change_me_in_week_0_day_5_32chars_min
# Local-dev: use the host LAN IP so the egress Chrome bot connects to the
# same address LiveKit advertises in ICE candidates (node_ip in livekit.yaml).
# Mismatched URLs (service-name here vs LAN IP in node_ip) caused the bot's
# WebSocket to time out with "page load error: websocket url timeout reached".
# On production: replace with your public TLS-fronted URL (wss://lms.example.com).
ws_url: ws://192.168.1.7:7880

redis:
  address: redis:6379
  # Templated from $REDIS_PASSWORD in .env by scripts/render-configs.sh.
  # Egress doesn't honor EGRESS_REDIS_PASSWORD or LIVEKIT_REDIS_PASSWORD env
  # overrides (both verified by isolated container test) so the password has
  # to be in this file at runtime. The rendered `egress.yaml` is gitignored;
  # only this `.tpl` source is committed.
  password: ${REDIS_PASSWORD}

# Local file output — BullMQ worker uploads to MinIO after recording finishes
file_output:
  local: true

# Chrome inside container for rendering room layout
chrome_key_file_path: ""

# Log level
log_level: info

# Health check endpoint (used by docker healthcheck if enabled)
health_port: 7889

# Self-reported CPU cost per egress job type. Egress refuses to accept a job
# unless `available CPU >= cost`. The defaults below come from LiveKit's
# upstream sample config (sized for 1080p60 rendering) and were way too
# pessimistic for our actual workload:
#
#   - The app calls startRoomCompositeEgress with H264_720P_30 (see
#     src/lib/livekit.ts:249). At that resolution + framerate, room composite
#     uses ~1.2–1.5 CPU on a t3.large equivalent, not 3.5.
#   - With the upstream values, a 2 vCPU host (t3.large) would refuse every
#     room composite job ("not enough cpu"), and LiveKit's egress API would
#     return "no response from servers" to the app. Sessions ended without
#     a Recording row being created → /classroom/[id]/recording 404s.
#
# Values below are sized for 720p30 H.264 on a 2 vCPU box. If you upgrade to
# t3.xlarge AND want to record at 1080p, raise these back closer to upstream.
cpu_cost:
  room_composite_cpu_cost: 1.5
  audio_room_composite_cpu_cost: 0.3
  track_composite_cpu_cost: 1.0
  track_cpu_cost: 0.5
  web_cpu_cost: 1.5
