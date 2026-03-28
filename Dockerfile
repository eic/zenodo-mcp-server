# syntax=docker/dockerfile:1

# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY --from=builder /app/build ./build

RUN chown -R node:node /app

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

ENV NODE_ENV=production \
    ZENODO_BASE_URL=https://zenodo.org

LABEL org.opencontainers.image.title="Zenodo MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for querying and managing Zenodo repositories" \
      org.opencontainers.image.vendor="EIC" \
      org.opencontainers.image.source="https://github.com/eic/zenodo-mcp-server" \
      org.opencontainers.image.licenses="MIT"

CMD ["node", "build/src/index.js"]
