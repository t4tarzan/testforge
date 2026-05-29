#!/usr/bin/env node
// Entry point. Subcommands:
//   (none)        start the MCP server
//   setup         interactive configuration wizard
//   --help|-h     env-var reference
const arg = process.argv[2];

if (arg === 'setup' || arg === 'init' || arg === 'configure') {
  import('./dist/setup.js').then((m) => m.runSetup()).catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
} else if (arg === '--help' || arg === '-h' || arg === 'help') {
  console.log(`
TestForge MCP — self-hosted code analysis (22 dimensions + LLM test gen + sims)

Usage:
  npx -y @whitenoisenpm/testforge-mcp            Start the server
  npx -y @whitenoisenpm/testforge-mcp setup      Interactive config wizard
  npx -y @whitenoisenpm/testforge-mcp --help     This help

Config is read from ~/.testforge/.env (written by 'setup'); real environment
variables always override it. Tier-1 analysis needs NO config. Tier-2
(generate-and-run / simulate) needs an AI provider.

AI provider (pick one):
  OPENROUTER_API_KEY        Cloud key (DeepSeek/Kimi/etc. via OpenRouter)
  TESTFORGE_LLM_BASE_URL    OpenAI-compatible endpoint for a LOCAL model server
                            (Ollama http://localhost:11434/v1, LM Studio :1234/v1).
                            From Docker, use http://host.docker.internal:<port>/v1
  TESTFORGE_LLM_API_KEY     Key for the above (blank for most local servers)
  TESTFORGE_PRIMARY_MODEL   Default deepseek/deepseek-v4-flash
  TESTFORGE_FALLBACK_MODEL  Default moonshotai/kimi-k2.6

Server:
  TESTFORGE_MCP_PORT          Default 33221
  TESTFORGE_RUN_SECRET        Bearer that gates Tier-2 endpoints
  TESTFORGE_CLONE_TIMEOUT_MS  Git-clone timeout, default 120000 (bump for huge repos)
  TESTFORGE_MAX_FILES         Default 8000 (raise for large monorepos)
  TESTFORGE_MAX_TOTAL_BYTES   Default 50000000

Database: a local SQLite file (~/.testforge/history.db) is auto-created. No setup.

Docs: https://testforge.run/#/docs
`);
} else {
  import('./dist/index.js');
}
