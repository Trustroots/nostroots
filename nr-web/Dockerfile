FROM node:20-slim

WORKDIR /app

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

# Copy package files from monorepo root
COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./

# Copy nr-web package.json
COPY nr-web/package.json ./nr-web/

# Install dependencies
# Skip postinstall scripts since patch-package is for nr-app, not nr-web tests
# If lockfile is outdated, it will be updated during install
# In CI environments, ensure lockfile is up to date before building
RUN pnpm install --frozen-lockfile --ignore-scripts || ( \
      echo "⚠️  Lockfile outdated. Updating..." && \
      pnpm install --no-frozen-lockfile --ignore-scripts \
    )

# Install Playwright browsers (Chromium only for smaller image)
RUN cd nr-web && npx playwright install chromium --with-deps

# Copy test files and source (will be overridden by volume mount in docker-compose)
COPY nr-web/ ./nr-web/

WORKDIR /app/nr-web

# Default command runs all tests
CMD ["pnpm", "test:local:all"]
