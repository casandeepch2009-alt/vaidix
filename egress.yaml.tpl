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

# Resource limits — prevent container OOM
cpu_cost:
  room_composite_cpu_cost: 3.5
  audio_room_composite_cpu_cost: 0.5
  track_composite_cpu_cost: 2.0
  track_cpu_cost: 1.0
  web_cpu_cost: 3.0
