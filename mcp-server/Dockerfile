# Fly.io Dockerfile for TestForge MCP Server
FROM node:22-slim

# git: repo cloning for /clone-and-analyze.
# python3/make/g++: native build toolchain for better-sqlite3 (history.db).
# curl/ca-certificates: fetch the docker CLI below.
RUN apt-get update && apt-get install -y git python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI ONLY (no daemon) — managed Tier-2 spawns hardened sandbox runner
# containers via a mounted host docker socket. Self-host doesn't use this image
# (it runs the MCP on the host with the host's docker). Static binary keeps the
# image small.
RUN ARCH="$(uname -m)" \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${ARCH}/docker-27.3.1.tgz" \
       | tar xz --strip-components=1 -C /usr/local/bin docker/docker \
    && docker --version

# docker compose v2 plugin — compose-aware simulations boot multi-service stacks
# (FastAPI+Postgres+Redis etc.) so real load/chaos can run on apps the single-
# Dockerfile wedge can't. Just the CLI plugin; it talks to the same daemon
# (the socket-proxy on the managed box).
RUN case "$(uname -m)" in x86_64) CARCH=x86_64;; aarch64|arm64) CARCH=aarch64;; *) CARCH="$(uname -m)";; esac \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${CARCH}" \
       -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && docker compose version

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copy source + the static install-guide page (served at /public)
COPY src/ ./src/
COPY public/ ./public/
COPY tsconfig.json ./

# The server reads TESTFORGE_MCP_PORT (default :33221); Fly routes to
# internal_port 3001, so pin the listen port to match. GIT_TERMINAL_PROMPT=0
# makes clones of missing/private repos fail fast instead of hanging on a
# credential prompt.
ENV TESTFORGE_MCP_PORT=3001
ENV GIT_TERMINAL_PROMPT=0
ENV NODE_ENV=production

EXPOSE 3001

# Run with tsx (TypeScript execution)
CMD ["tsx", "src/index.ts"]
