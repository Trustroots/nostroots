# Official image includes Chromium, WebKit, FFmpeg, and all OS libs (avoids fragile apt on slim).
# Keep tag aligned with @playwright/test major.minor used in package.json (see pnpm-lock or `pnpm ls @playwright/test`).
FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app/nr-web

RUN npm install -g pnpm

# Copy nr-web package manifest (standalone project)
COPY nr-web/package.json ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Copy test files and source (overridden by volume mount in docker-compose for local dev)
COPY nr-web/ ./

CMD ["pnpm", "test:local:all"]
