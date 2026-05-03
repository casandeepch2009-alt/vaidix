# LiveKit Load Test Results

HARDENING-PLAN.md item #19. Run before any LVPEI cohort gets the "100 concurrent" promise. Update this file each time the test is run on a new host class.

## How to run

```bash
# 1. Bring the prod stack up on the target hardware.
./scripts/load-env.sh
docker compose -f docker-compose.prod.yml --env-file .env up -d

# 2. From a separate test client (so client CPU isn't on the SUT):
tsx --env-file=.env.local --env-file=.env tests/load/livekit-100.ts \
    --participants=100 --hold=120 --room=loadtest-$(date +%s)
```

## SLO

| Metric | Target |
|---|---|
| Connect success rate | ≥ 99 % |
| Connect latency p95 | < 5 000 ms |
| Total disconnects during hold | ≤ 1 % of participants |
| LiveKit container CPU during steady state | < 80 % |
| Egress container CPU (when 1 simultaneous recording) | < 90 % |

## Results log

| Date | Host | Participants | Success % | p95 connect | Disconnects | LK CPU peak | Egress CPU peak | Outcome | Notes |
|---|---|---|---|---|---|---|---|---|---|
| _yet to run_ | — | — | — | — | — | — | — | — | run during H2 sprint |

## Tuning levers, ranked

1. `livekit.yaml: max_participants` — reduce to whatever the test proves stable.
2. `egress.yaml: cpu_cost / track_cpu_cost` — raise so egress doesn't starve LiveKit.
3. Container CPU limits in `docker-compose.prod.yml` (currently `cpus: 4` for both).
4. UDP port range for media — confirm `50000-50100` isn't being NAT-narrowed.
5. NIC offloading (`ethtool -K <iface> tso off gso off gro off`) on cheap hardware.
