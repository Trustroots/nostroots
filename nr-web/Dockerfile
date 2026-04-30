FROM node:24-slim

WORKDIR /app/nr-web
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy nr-web package manifest (standalone project, no pnpm-workspace file)
COPY nr-web/package.json ./

# Install dependencies (nr-web currently has no lockfile in repo)
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Install browser matching the project's Playwright version
RUN pnpm exec playwright install webkit --with-deps

# Copy test files and source (will be overridden by volume mount in docker-compose)
COPY nr-web/ ./

# Default command runs all tests
CMD ["pnpm", "test:local:all"]
