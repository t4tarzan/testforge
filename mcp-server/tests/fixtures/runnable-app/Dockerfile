# Single-app Dockerfile so detectRunnable() classifies this fixture as runnable
# (method=dockerfile) and /simulate boots it for a REAL load/chaos run.
FROM node:20-alpine
WORKDIR /app
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
