FROM node:20-slim

WORKDIR /app/nr-web

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

# Copy nr-web package.json and install dependencies directly (not as workspace)
COPY nr-web/package.json ./

# Install dependencies directly in nr-web (not as pnpm workspace)
RUN pnpm install --ignore-scripts

# Install Playwright browsers (Chromium only for smaller image)
RUN npx playwright install chromium --with-deps

# Copy test files and source (will be overridden by volume mount in docker-compose)
COPY nr-web/ ./

# Default command runs all tests
CMD ["pnpm", "test:local:all"]
