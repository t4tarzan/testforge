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
