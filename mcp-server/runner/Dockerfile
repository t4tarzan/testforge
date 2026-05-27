# TestForge Tier-2 test runner — executes LLM-generated Vitest files in
# isolation. Pre-installs vitest + a minimal package.json so a per-run
# `npm install` is not needed (saves ~15-20s per invocation).
#
# Build: docker build -t testforge-runner:local mcp-server/runner
# Run:   docker run --rm -v /tmp/tforge-run-XYZ:/runner/tests testforge-runner:local
#        (the mount writes the test files in; the container writes JSON to stdout)
FROM node:22-slim

WORKDIR /runner

# Pre-install vitest + typescript at build time so the cold path is fast.
# vitest brings @vitest/runner, expect, tinyspy etc. transitively.
RUN --mount=type=cache,target=/root/.npm \
    npm init -y >/dev/null && \
    npm install --save-dev vitest@^3.0.0 typescript@^5.0.0 >/dev/null 2>&1 && \
    mkdir -p tests

# Minimal tsconfig for the generated tests — DOM lib OFF so test files can
# use 'Request' / 'Response' as local type names without colliding with the
# fetch globals. Strict mode stays on so real bugs in generated code surface.
RUN cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["es2022"],
    "types": ["vitest/globals"]
  },
  "include": ["tests/**/*"]
}
JSON

# Vitest config — JSON reporter to stdout, sane timeouts so a hanging test
# doesn't pin the container open.
RUN cat > vitest.config.ts <<'TS'
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    reporters: ['default'],
    silent: false,
  },
});
TS

# Entrypoint script — captures vitest's JSON reporter output to stdout and
# exits with the test runner's status code. Stderr is preserved for diagnostics.
RUN cat > /runner/entrypoint.sh <<'SH'
#!/bin/sh
cd /runner
exec npx vitest run --reporter=json --no-color 2>/dev/null
SH
RUN chmod +x /runner/entrypoint.sh

ENTRYPOINT ["/runner/entrypoint.sh"]
