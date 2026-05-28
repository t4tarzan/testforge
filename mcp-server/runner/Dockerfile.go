# TestForge Tier-2 sandbox runner — Go. Executes LLM-generated `go test` files
# in --network=none isolation and emits `go test -json` output to stdout (same
# contract as the node/vitest runner).
FROM golang:1.22-bookworm

LABEL org.opencontainers.image.source="https://github.com/t4tarzan/testforge"
LABEL org.opencontainers.image.description="TestForge Tier-2 sandbox runner — Go 1.22 stdlib testing. Runs LLM-generated go test files in --network=none isolation."
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /runner
# Stay fully offline: never fetch a toolchain, never hit the module proxy
# (the generated tests are self-contained, stdlib only).
ENV GOTOOLCHAIN=local GOFLAGS=-mod=mod GOPROXY=off CGO_ENABLED=0

# Tests are bind-mounted read-only at /runner/tests. Go needs a writable module
# dir, so copy them into /tmp/work, init a throwaway module, and stream the
# machine-readable test events to stdout.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'mkdir -p /tmp/work && cp /runner/tests/*_test.go /tmp/work/ 2>/dev/null' \
  'cd /tmp/work' \
  '[ -f go.mod ] || go mod init testforge_run >/dev/null 2>&1' \
  'go test -json . 2>/dev/null' \
  > /runner/entrypoint.sh && chmod +x /runner/entrypoint.sh

ENTRYPOINT ["/runner/entrypoint.sh"]
