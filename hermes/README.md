# `hermes/` — the TestForge self-improvement flywheel (L0)

This folder is TestForge's **autonomous improvement loop**, packaged to ship
*with the repo*. It runs the product on itself (plus a rotating public repo),
asks a brain (Claude) for the single highest-value real improvement, and posts a
ranked plan + a short digest — **without changing code** (autonomy level L0).

It's named `hermes/` because [Hermes Agent](https://github.com/NousResearch/hermes-agent)
is what schedules it today — but nothing here is Hermes-specific. The loop is a
plain Node script with a stdout digest, so **any** scheduler (cron, launchd,
GitHub Actions, Claude Code routines) can drive it. Hermes is just the hands.

Design & rationale: [`docs/knowledge/Flywheel.md`](../docs/knowledge/Flywheel.md).
Brain instructions: [`docs/flywheel/proposer-prompt.md`](../docs/flywheel/proposer-prompt.md).
Where we are: [`docs/knowledge/Status.md`](../docs/knowledge/Status.md).

## The cycle

```
scan.mjs            cycle.mjs (orchestrator)
─────────           ─────────────────────────────────────────────────────────
ensure local MCP    1. GATHER   run scan.mjs → state/findings.json
analyze SELF   ───▶ 2. TRIAGE   optional local-model pass ($TESTFORGE_TRIAGE)
analyze 1 rotating  3. PROPOSE  proposer-prompt + findings + ledger + changelog
  showcase repo                  → brain (claude -p) → ranked plan
→ findings.json     4. EMIT     append ledger entries · save plan · print digest
```

`stdout` of `cycle.mjs` is **only the Telegram digest**, so Hermes can run it
`--no-agent` and deliver that text verbatim. A quiet cycle (nothing clears the
bar) is a **success**, not a failure.

## Files

| file | role |
|---|---|
| `scan.mjs` | **Gather.** Runs the local analyzer (`:33221`) on the repo itself + a date-rotating showcase repo → proposer-shaped `state/findings.json`. |
| `cycle.mjs` | **Orchestrator + brain call.** scan → assemble bundle → `claude -p` → append ledger → emit digest. |
| `ledger.md` | Append-only proposed/shipped/rejected history (the anti-repeat memory). In prod, point `$TESTFORGE_LEDGER` at the Obsidian note. |
| `register-hermes.sh` | One-shot: drop a launcher in `~/.hermes/scripts/` + `hermes cron create … --no-agent --deliver telegram`. |
| `state/` | Runtime artifacts (`findings.json`, `last-plan.md`, `last-digest.txt`). Gitignored. |

## Run it now (no scheduler)

```bash
# 1. Gather only — analyze self + today's showcase repo, write findings.json:
node hermes/scan.mjs --print            # add --self-only to skip the clone

# 2. Assemble the brain bundle but DON'T call the brain (inspect state/last-bundle.md):
node hermes/cycle.mjs --dry

# 3. Full cycle — scan, ask the brain (claude -p), append the ledger, print the digest:
node hermes/cycle.mjs
```

Requires Node, the built MCP (`cd mcp-server && npm run build`), and the `claude`
CLI on PATH. `scan.mjs` auto-starts `mcp-server/dist/index.js` on `:33221` if
nothing answers `/health`.

**The brain is `claude -p`** (override via `$TESTFORGE_BRAIN`), the bundle piped
to its stdin. Run **headless**: in non-interactive print mode the permission
system auto-denies edits/commands (no TTY to approve), so the brain may *read*
repo files to verify a finding but can never mutate — important because the
bundle carries **untrusted showcase-repo content** (finding text from arbitrary
public repos = a prompt-injection surface). In practice it reads the cited files
(e.g. confirms `src/db/client.ts:30 max:10`), dedupes against the ledger, and
emits only the ranked plan + digest. *Don't* add `--permission-mode plan` — it
stalls under `-p` waiting to present its plan for an approval that never comes.

## Schedule it with Hermes

```bash
hermes/register-hermes.sh                 # dry: print the command it would run
hermes/register-hermes.sh --create        # write launcher + create the job
SCHEDULE='0 9 * * *' hermes/register-hermes.sh --create   # daily 09:00 instead of 'every 6h'
```

## Configuration (env)

| var | default | meaning |
|---|---|---|
| `TESTFORGE_BRAIN` | `claude -p` | brain command; receives the bundle on stdin, returns the plan on stdout. Headless = read-only in practice (see above); override only if you understand the injection surface |
| `TESTFORGE_LEDGER` | `hermes/ledger.md` | ledger path — point at the Obsidian vault note in prod |
| `TESTFORGE_TRIAGE` | _(unset)_ | optional cheap local-model command; receives findings on stdin, returns filtered JSON |
| `TESTFORGE_MCP` | `http://localhost:33221` | analyzer base URL |

## Earning more autonomy

L0 only proposes. Graduating to L1 (auto-PR) → L2 (auto-merge safe classes) →
L3 (continuous + canary) is gated by the **four-layer verification gate** (CI ·
TestForge self-grade · adversarial review · E2E). See
[`docs/knowledge/Flywheel.md`](../docs/knowledge/Flywheel.md). Don't add
code-writing here until that gate exists.
