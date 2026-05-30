# The 22 Dimensions

Back to [[TestForge]]. Per-dimension methodology + language coverage + N/A
criteria are the single source of truth in `src/data/dimensionMeta.ts` (also
served to the self-host dashboard at `/dimension-meta.json`, generated from that
file so they never drift).

Tier-1 analysis runs all of these, deterministically. Each returns a score
([[Scoring]]) + findings (with a suggested fix), or **N/A** with a reason when it
doesn't apply to the repo.

| # | Dimension | What it detects | Depth |
|---|---|---|---|
| 1 | **Security** | AST taint: request input → SQL/exec/subprocess/open/HTTP sinks, sanitizer-aware (JS/TS + Python/FastAPI); secrets/CORS/config checks | deep |
| 2 | **Kubernetes** | Parses every manifest + Helm chart: securityContext, RBAC wildcards, resource limits, probes, image tags, secrets-in-ConfigMaps, NetworkPolicy | deep |
| 3 | **OWASP** | Maps findings to OWASP Top-10 coverage | medium |
| 4 | **Supply Chain** | Resolves name@version from lockfiles (npm/PyPI/Go) → live OSV.dev; non-registry/integrity/dup checks; offline-safe | medium |
| 5 | **License** | SPDX categorization from node_modules metadata | shallow |
| 6 | **Unit Tests** | Real coverage (lcov/Cobertura/Istanbul) when present, else heuristic; AST test-quality (assertion-free/empty/skipped) for JS/TS + Python | medium |
| 7 | **Mutation** | Assertion kill-potential (strong vs truthiness-only), test-to-source ratio, matcher variety | medium |
| 8 | **Property-Based** | Framework + property-assertion call-site detection | shallow |
| 9 | **Edge Cases** | Per-line footguns: JSON.parse-untrycaught, parseInt-no-radix, mutable-default-arg, bare-except, etc. (JS/TS + Python) | medium |
| 10 | **Contract** | Endpoint discovery (JS/TS + FastAPI/Flask) cross-referenced vs OpenAPI / response_model | medium |
| 11 | **Predictive Risk** | Per-file risk from complexity + N+1 + dead-exports + size + TODOs + security; size-independent ([[Scoring]]) | medium |
| 12 | **N+1 Queries** | Loop constructs with DB calls inside, exempting Promise.all | shallow |
| 13 | **Dead Code** | Unused exports + unused **runtime** deps (devDeps excluded — they're tooling) | shallow |
| 14 | **Load** | Capability score: rate-limit/cache/pool/probes/timeouts/circuit-breaker/compression; live throughput is the [[Simulation-Engine]] | shallow |
| 15 | **Chaos / Resilience** | Retry, error handling, graceful shutdown patterns | shallow |
| 16 | **Agentic Scale** | Predicts behavior under many concurrent AI agents | shallow |
| 17 | **Accessibility** | JSX/HTML a11y (alt text, labels, ARIA); scored on issue **density** per √UI-file | medium |
| 18 | **Visual Regression** | Inline-style / hardcoded-pixel / hex-color smells | shallow |
| 19 | **Vision** | Observability/analytics/flags deps + README goal alignment | shallow |
| 20 | **Scope** | Documented features (README) actually implemented in source | shallow |
| 21 | **Stack** | Tech-stack quality (strengths + weaknesses) | shallow |
| 22 | **DORA** | CI/deploy signals + observability/test deps | shallow |

## Language coverage (the honesty banner)
The analyzer is deepest on **JS/TS** (Babel AST). **Python** is native for
several dimensions (FastAPI/Flask taint, edge cases, endpoints, test quality) via
a `python3` stdlib-`ast` subprocess. **Go** is mostly counted-only (no Go
parser). **Kubernetes YAML/Helm** is fully parsed. Reports surface a
`languageCoverage` banner so a high score never hides an unanalyzed half of a
polyglot repo. The 22nd dimension (Kubernetes) was added because the biggest
real risk in a k8s platform lives in YAML, not app code.
