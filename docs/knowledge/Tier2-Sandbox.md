# Tier 2 — Generate & Run (LLM tests + sandbox)

Back to [[TestForge]]. Code: `mcp-server/src/generator/*`,
`mcp-server/src/runner/docker-runner.ts`, route in `src/index.ts`.

Tier-2 takes the top findings from a Tier-1 run, asks an LLM to write a **real
test** per finding (Vitest / pytest / Go test), and **executes** them in a
hardened Docker sandbox. Opt-in; needs an AI provider + Docker.

## The pipeline
1. `POST /generate-and-run {findings, maxFindings}`.
2. `generate-tests.ts` → `generateObject` (AI SDK, Zod-schema-enforced) per
   finding, with provider rotation (primary → fallback). Tests must be
   self-contained (recreate the footgun locally; don't import the project).
3. `docker-runner.ts` writes the files to a per-run dir and runs the matching
   sandbox image with `--network=none --cap-drop=ALL --no-new-privileges`,
   memory/pids/cpu caps, tmpfs `/tmp`, test files mounted read-only.
4. Parses the framework's JSON output → uniform `RunResult`.

## AI provider (3 ways) — see [[Self-Host-and-BYOK]]
- **OpenRouter** (cloud) via `OPENROUTER_API_KEY`.
- **Local model server** via `TESTFORGE_LLM_BASE_URL` (Ollama/LM Studio/vLLM) —
  free, private, no key. `providerFor()` builds a per-request provider.
- **Managed BYOK** — the user stores their OpenRouter key on the website; the
  proxy forwards it as `X-LLM-Key` so the hosted run uses *their* key/billing.

## Hard-won lessons (all fixed; see [[Evolution]])
- **Docker preflight.** If Docker is missing/down, tests are still *generated*
  and shown, clearly marked "generated · not run" with install help — never a
  blank `0/0 ERRORED`.
- **Clean JSON.** The JS runner used to pipe vitest's JSON report to stdout;
  elaborate test output corrupted it → blank `0/0 ERRORED`. Now the report is
  written to a file and only that is streamed to stdout (vitest noise → stderr).
- **No-filePath findings.** Supply-chain / project-level k8s findings have no
  file; `detectLanguage`/filename-builder must tolerate `undefined` (was a 500).
- **Multi-arch + versioned runner images.** `ghcr.io/t4tarzan/testforge-runner*`
  are multi-arch (amd64+arm64) and version-pinned (`v0.36.x`) — Docker caches
  `:latest` and never re-pulls, so a fix only reaches users on a fresh tag.
- **Build-locally fallback.** If the GHCR image can't be pulled
  (private/offline), the runner **builds** it from the Dockerfile shipped in the
  npm package — Tier-2 needs only Docker, no registry access.
- **Run-secret gate.** Managed Tier-2 is gated by `TESTFORGE_RUN_SECRET`;
  loopback requests whose secret came from the local config file are exempt so a
  self-host user is never locked out of their own dashboard. The per-request
  `X-LLM-Key` is only honored behind that gate.
