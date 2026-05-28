# Fly.io Dockerfile for TestForge MCP Server
FROM node:22-slim

# git: repo cloning for /clone-and-analyze.
# python3/make/g++: native build toolchain for better-sqlite3 (history.db),
# in case a prebuilt binary isn't available for this platform/ABI.
RUN apt-get update && apt-get install -y git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

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
