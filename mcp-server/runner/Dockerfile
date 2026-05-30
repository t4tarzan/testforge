# TestForge Tier-2 test runner — executes LLM-generated Vitest files in
# isolation. Pre-installs vitest + a minimal package.json so a per-run
# `npm install` is not needed (saves ~15-20s per invocation).
#
# Build: docker build -t testforge-runner:local mcp-server/runner
# Run:   docker run --rm -v /tmp/tforge-run-XYZ:/runner/tests testforge-runner:local
#        (the mount writes the test files in; the container writes JSON to stdout)
FROM node:22-slim

# Links this image to the public GitHub repo on GHCR so the package page
# shows source/readme and inherits permissions correctly.
LABEL org.opencontainers.image.source="https://github.com/t4tarzan/testforge"
LABEL org.opencontainers.image.description="TestForge Tier-2 sandbox runner — node 22 + vitest + tsx, pre-installed. Runs LLM-generated Vitest files in --network=none isolation."
LABEL org.opencontainers.image.licenses="MIT"

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

# Entrypoint — write the JSON report to a tmpfs file so STDOUT stays pure JSON
# (vitest's own progress/error output goes to STDERR, which the host captures
# for diagnostics instead of discarding it). If vitest crashes during
# collection (e.g. a bad generated test) the JSON file is empty and the real
# error is on stderr — surfaced to the user instead of a blank "ERRORED 0/0".
RUN cat > /runner/entrypoint.sh <<'SH'
#!/bin/sh
cd /runner
npx vitest run --reporter=json --outputFile=/tmp/result.json --no-color 1>&2
cat /tmp/result.json 2>/dev/null
SH
RUN chmod +x /runner/entrypoint.sh

ENTRYPOINT ["/runner/entrypoint.sh"]
