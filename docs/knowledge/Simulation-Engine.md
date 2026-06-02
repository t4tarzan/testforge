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

## Cluster / runtime tier — "Simulate" (the paid Tier-2 runtime half)
The single-app sim above handles a bootable Dockerfile/compose target. The
**runtime tier** extends it to apps that only run on a cluster (Kubernetes-native
platforms, operators, appstores) — the class that *can't* be booted by a lone
Dockerfile and whose backends call the cluster API at startup. The flow:
1. **Provision** a throwaway Kubernetes cluster (k3s).
2. **Deploy** the target through *its own* Helm/helmfile (not a synthesized
   compose), with the real chart values + image registry.
3. **Load / stress / chaos** against the live ingress — rps ceiling + p50/p99
   latency knee, a concurrency sweep, and a pod-kill under load → measured
   **outage window + MTTR** (surfaces single-replica SPOFs, missing PDB/probes).
4. **Live runtime audit** — dependency health (does Postgres/Redis/object-store
   actually answer?), ingress/egress map, and the differentiator:
   **static→runtime policy-enforcement verification** — when the static pass
   flags run-as-root / privileged / missing-probes, deploy a *violating* pod and
   check whether the cluster's admission policy (Kyverno/PSA) actually blocks it.
   "Does your cluster enforce what your manifests imply?" is something no static
   analyzer can answer.
5. **Appstore walk** (for catalog platforms) — install catalog apps, assert each
   reaches Ready, verify auto-provisioned dependencies + ingress wiring, flag
   rollbacks and unpullable/GPU-only sidecars.

**Positioning:** Simulate is the **runtime half of Tier-2** (Generate & Run =
sandbox unit tests; Simulate = exercise the *running* system), a **managed paid
capability** (Pro+) — see the 0.36.6 changelog + [[Evolution]] Arc 9. First
validated end-to-end on a production-grade, multi-service Kubernetes platform
(load/chaos/appstore + a policy-not-enforced finding). Today it is operator-run
for paid plans; self-serve repo→cluster automation is the next code milestone (a
private, replayable LKGC runbook + script already encodes the full sequence).
The thesis: **TestForge grades your manifests; Simulate grades the running
system** — capacity, resilience, dependency health, and whether the security
posture is *enforced* or merely *declared*.
