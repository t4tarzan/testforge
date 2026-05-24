# Fly.io Dockerfile for TestForge MCP Server
FROM node:22-slim

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
