# @testforge/mcp

**AI-powered testing in your IDE.** The TestForge MCP server integrates with Cursor, VS Code, Windsurf, Claude Code, and any MCP-compatible editor to provide real-time code analysis.

## Features

- 🔒 **Security Scanning** — SAST analysis, vulnerability detection, OWASP checks
- 🧪 **Unit Test Analysis** — Coverage estimation, test framework detection
- ⚡ **Load Analysis** — Rate limiting, caching, connection pooling checks
- ♿ **Accessibility** — WCAG compliance, alt text, form labels
- 👁️ **Vision & Goal Alignment** — Observability, feature flags, analytics
- 🎯 **Scope Coverage** — Documented vs implemented features
- 📦 **Stack Analysis** — Technology choices, architecture quality
- 📊 **Reports** — Structured PRD with phased remediation plans

## Quick Start

```bash
# One-command install for your IDE
npx @testforge/mcp install

# Or start the server directly
npx @testforge/mcp serve
```

## Manual MCP Setup (Cursor)

1. Open Cursor Settings → Features → MCP
2. Add new MCP server with this config:

```json
{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["-y", "@testforge/mcp", "serve"],
      "env": {
        "TESTFORGE_MCP_PORT": "3001"
      }
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `testforge_analyze` | Scan codebase structure (files, endpoints, dependencies) |
| `testforge_test` | Run full test suite across all dimensions |
| `testforge_quick_scan` | Fast 30-second security + unit scan |
| `testforge_report` | Generate structured PRD from test results |

## REST API

When running as a standalone server:

```bash
# Clone and analyze any public repo
curl -X POST http://localhost:3001/clone-and-analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/owner/repo"}'

# Health check
curl http://localhost:3001/health
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TESTFORGE_MCP_PORT` | `3001` | Server port |
| `DATABASE_URL` | - | Neon PostgreSQL connection |
| `TMP_DIR` | `/tmp/testforge-repos` | Temp directory for cloned repos |

## License

MIT
