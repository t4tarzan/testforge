# TestForge — Knowledge Map

> Map of Content (MOC) for the TestForge knowledge graph. Open this folder as an
> Obsidian vault — every note is plain Markdown with `[[wikilinks]]`.

**TestForge** is a code-analysis platform: point it at a repo and it runs **22
analysis dimensions** ([[Dimensions]]), then optionally **generates and runs
real tests** ([[Tier2-Sandbox]]) and **simulates load/chaos/agents** against the
running app ([[Simulation-Engine]]). It runs three ways — a hosted web service, a
self-hosted `npx` MCP server, and inside an AI IDE (Cursor/Claude/VS Code).

## Start here
- **[[Status]]** — current state + "what happened / where we are" handoff. **Fresh context? Read this first.**
- [[Architecture]] — the three planes (web · managed MCP · self-host MCP) and how a request flows.
- [[Dimensions]] — the 22 analysis dimensions and what each detects.
- [[Scoring]] — the diminishing-returns scoring philosophy and the "no cry-wolf" rule.
- [[Tier2-Sandbox]] — LLM test generation + the hardened Docker sandbox.
- [[Simulation-Engine]] — load / chaos / agent simulations against the real app.
- [[Self-Host-and-BYOK]] — running it yourself, the settings panel, and bring-your-own-key.
- [[Reports]] — the report formats (live, downloadable Markdown, curated In-the-Wild).
- [[Flywheel]] — the (in-design) autonomous self-improvement loop.
- [[Evolution]] — the timeline of how all of this came to be.

## Canonical sources (single source of truth)
- **Changelog** — every published release with a one-line rationale: `src/data/changelog.ts` (rendered at `testforge.run/#/changelog`). This is the authoritative dated history.
- **Public docs** — `testforge.run/#/docs` (the Docs page, `src/pages/Docs.tsx`).
- **npm package readme** — `mcp-server/README.md`.
- **Repo README** — `README.md` (product overview + architecture).
- **Internal ops** (deploy, the managed VPS, secrets) — NOT in this public repo; kept in the operator's private notes/agent memory.

## One-paragraph summary
Tier-1 analysis is 100% deterministic and needs no AI or network (static AST +
config parsing across JS/TS, Python, Go, and Kubernetes YAML). Tier-2 and the
simulation engine are opt-in and need an AI provider and/or Docker. The whole
thing is open source (MIT) and self-hostable; the hosted service is a
convenience layer with auth, billing, and curated showcase reports.
