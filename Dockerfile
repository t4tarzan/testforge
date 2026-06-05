# Self-contained TestForge image: web SPA (Vite dist) + MCP server (Fastify) in one
# container. webapp-server.cjs serves dist on :9991 and proxies /api → 127.0.0.1:9990 (MCP).
FROM node:20-slim AS webbuild
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS mcpbuild
WORKDIR /app/mcp-server
COPY mcp-server/package*.json ./
RUN npm ci
COPY mcp-server/ ./
RUN npm run build && npm ci --omit=dev

FROM node:20-slim
WORKDIR /app
COPY --from=webbuild /app/dist ./dist
COPY --from=mcpbuild /app/mcp-server/dist ./mcp-server/dist
COPY --from=mcpbuild /app/mcp-server/node_modules ./mcp-server/node_modules
COPY webapp-server.cjs ./webapp-server.cjs
ENV TESTFORGE_WEB_PORT=9991 TESTFORGE_MCP_PORT=9990
EXPOSE 9991
CMD ["sh", "-c", "node mcp-server/dist/index.js & node webapp-server.cjs"]
