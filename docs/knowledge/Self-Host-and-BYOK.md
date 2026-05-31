# Self-Host & BYOK

Back to [[TestForge]].

## Self-host (npx)
```
npx -y @whitenoisenpm/testforge-mcp@latest        # start → localhost:33221
npx -y @whitenoisenpm/testforge-mcp setup         # interactive config wizard
npx -y @whitenoisenpm/testforge-mcp --help        # env-var reference
```
- **Tier-1 (22 dimensions) needs no config.** Tier-2 needs an AI provider + Docker.
- **No database to install** — run history auto-stores in SQLite at
  `~/.testforge/history.db`.
- Always use `@latest` (and pin `@latest` in IDE MCP configs) — npx caches, so a
  config without it relaunches a stale version forever. Was a real "stuck on
  0.25.2" bug; see [[Evolution]].

## Docker (build from source)
For servers / keeping Node off the host. Build the image, run with an env file;
the three mounts enable Tier-2 + local-code analysis (validated workflow):
```
git clone https://github.com/t4tarzan/testforge.git && cd testforge
docker build -t testforge-mcp:selfhost mcp-server/
printf 'OPENROUTER_API_KEY=sk-or-v1-...\n' > .env
docker run -d --name testforge -p 33221:3001 \
  --env-file .env \
  -v /var/run/docker.sock:/var/run/docker.sock \   # Tier-2 sandbox via host docker
  -v /root/.testforge/runs:/root/.testforge/runs \  # SAME path in+out (bind-mount must resolve on host daemon)
  -v /root/your-project:/work/your-project:ro \     # analyze via file:///work/your-project
  testforge-mcp:selfhost
```
Without the socket mount, Tier-1 works and Tier-2 tests are generated but not
run. The runs dir MUST be mounted at the same path inside and outside (the
sandbox's `-v hostMountDir:/runner/tests` is resolved by the *host* daemon). See
[[Tier2-Sandbox]].

## Config — three ways
Config lives in `~/.testforge/.env` (the server loads it on startup; real env /
Docker `-e` always overrides). It is set by:
1. **`setup` wizard** — pick provider/port/secret.
2. **Settings panel** on the dashboard (`localhost:33221` → ⚙ Settings) — OpenRouter
   key OR local Ollama/LM Studio URL+model; applies live (no restart) via
   `reloadLLM()` over ES live bindings. Backed by `GET|POST /config`, which is
   **strictly local-only** (loopback + never on a managed deployment, whose run
   secret is real-env-sourced not file-sourced).
3. **Env vars** directly.

Key env vars: `OPENROUTER_API_KEY`, `TESTFORGE_LLM_BASE_URL` (+ `_API_KEY`),
`TESTFORGE_PRIMARY_MODEL`/`_FALLBACK_MODEL`, `TESTFORGE_MCP_PORT`,
`TESTFORGE_RUN_SECRET`, `TESTFORGE_CLONE_TIMEOUT_MS` (default 120s — bumped from a
hard 30s that timed out on ~1.3 GB monorepos like Supabase),
`TESTFORGE_MAX_FILES` / `TESTFORGE_MAX_TOTAL_BYTES`.

## Local AI
Point Tier-2 at any OpenAI-compatible endpoint: Ollama
`http://localhost:11434/v1`, LM Studio `:1234/v1`, vLLM. From inside Docker use
`http://host.docker.internal:<port>/v1`. Free, private, no cloud key — verified
end-to-end with `qwen2.5-coder` via Ollama.

## Managed BYOK (hosted Tier-2 with your own key)
The free plan's Tier-2 is BYOK. Two routes:
- **Self-host** (above) — your key + code never leave your machine.
- **Hosted BYOK** — store your OpenRouter key on the website
  (Account → API Keys → "Tier-2 AI Key"). It's encrypted at rest (AES-256-GCM,
  key derived from `SESSION_SECRET` via HKDF — no new env var; `api/_crypto.js`),
  decrypted server-side only to forward as `X-LLM-Key`, never displayed back. The
  proxy (`api/generate-and-run.js`) then runs the hosted sandbox on *your* key,
  capped at `max(50, plan limit)`/mo to protect the shared infra. Paid plans use
  the server key (metered); free + BYOK gets hosted Tier-2 instead of a 402.

## Code stays local
Self-host makes no outbound calls except `git clone` and (Tier-2) the AI
provider you configured. The managed plane is a convenience layer; the analyzer
is the same open-source package either way. See [[Architecture]].
