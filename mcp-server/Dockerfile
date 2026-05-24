# Fly.io Dockerfile for TestForge MCP Server
FROM node:22-slim

# Install git for repo cloning
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev && npm install -g tsx

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Expose MCP server port
EXPOSE 3001

# Run with tsx (TypeScript execution)
CMD ["tsx", "src/index.ts"]
