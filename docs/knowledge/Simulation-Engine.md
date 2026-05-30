# Simulation Engine

Back to [[TestForge]]. Async endpoint `POST /simulate {repoUrl, dimensions}` →
returns a `jobId`; poll `GET /simulate/:jobId` for phased progress. Async because
a real sim runs minutes (would hit nginx's 300s proxy timeout).

Where [[Dimensions|Load]] is a *static capability* score, the simulation engine
measures **real behavior** by booting the app and driving traffic at it.

## Phases
- **prepareSandbox** — detect a Dockerfile (or docker-compose stack), build the
  image (legacy builder; BuildKit can't be proxied through the socket-proxy),
  boot it resource-capped on a throwaway `--internal` network, health-probe the
  EXPOSE/common ports, tear down at the end.
- **load** — autocannon ramp (10→500), reports p50/p90/p99 / rps / errorRate +
  breaking-point concurrency. A discarded **warmup** window runs first so a cold
  app isn't mis-reported as "broken."
- **agent** (opt-in) — ramps a fleet of concurrent agents with think-time
  (`--overallRate`, not `-R`) and measures `maxHealthyAgents`.
- **chaos** (opt-in) — baseline load → inject a fault (restart/crash or
  pause/freeze, via docker pause/unpause + restart through the proxy) → measure
  `errorRateDuringFault` → poll until recovered → `recoverySeconds`.

## Surfaces
- `/simulations` page renders real load/agent/chaos charts (recharts) from
  curated snapshots, and a "Run this live" button → guarded `api/simulate.js`
  proxy (allowlist by showcase slug only, server-forced small params, per-IP
  start limit) → polls the async job → renders the fresh result.

## Known limits
- Sim builds are **legacy-builder only** through the socket-proxy — repos needing
  BuildKit-only Dockerfile syntax (`RUN --mount`, `FROM --platform=$BUILDPLATFORM`
  without a prior ARG) can't build (reported honestly). Prebuilt-image stacks
  always work. Heavy stacks may need `TESTFORGE_SIM_BUILD_TIMEOUT_MS` raised.

See [[Architecture]] for where the sim runs (managed MCP, via the docker
socket-proxy with BUILD+NETWORKS enabled).
