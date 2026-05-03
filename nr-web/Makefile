.PHONY: test test-fast test-watch test-ui test-e2e test-e2e-fast test-unit build check-docker help

# Default target
.DEFAULT_GOAL := help

# Check Docker is available
check-docker:
	@bash scripts/check-docker.sh

# Update lockfile before building (if needed)
update-lockfile:
	@echo "Updating pnpm lockfile..."
	cd .. && pnpm install

# Build the Docker image
build: check-docker
	@echo "Building test Docker image..."
	@echo "Note: If build fails due to outdated lockfile, run: make update-lockfile"
	docker-compose build

# Run all tests (Vitest + Playwright on every project — slower, CI-parity)
test: build
	@echo "Running full test suite in Docker..."
	docker-compose run --rm tests

# Fast tests: Vitest + Playwright desktop Chromium only (no iOS WebKit project)
test-fast: build
	@echo "Running fast tests in Docker..."
	docker-compose run --rm tests pnpm test:local:fast

# Run tests in watch mode
test-watch: build
	@echo "Running tests in watch mode..."
	docker-compose run --rm tests pnpm test:local:watch

# Run tests with UI
test-ui: build
	@echo "Running tests with UI (accessible on http://localhost:51204)..."
	docker-compose run --rm -p 51204:51204 tests pnpm test:local:ui

# Run E2E tests only (all Playwright projects)
test-e2e: build
	@echo "Running E2E tests in Docker..."
	docker-compose run --rm tests pnpm test:local:e2e

# Run E2E tests on Chromium desktop only (fast)
test-e2e-fast: build
	@echo "Running fast E2E (Chromium) in Docker..."
	docker-compose run --rm tests pnpm test:local:e2e:fast

# Run unit/integration tests only
test-unit: build
	@echo "Running unit/integration tests in Docker..."
	docker-compose run --rm tests pnpm test:local

# Run with coverage
test-coverage: build
	@echo "Running tests with coverage..."
	docker-compose run --rm tests pnpm test:local:coverage

# Clean up Docker resources
clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v
	docker system prune -f

# Help message
help:
	@echo "nr-web Test Commands (Docker-first):"
	@echo ""
	@echo "  make test-fast     - Fast suite: Vitest + Playwright Chromium only"
	@echo "  make test          - Full suite: Vitest + all Playwright projects (CI-parity)"
	@echo "  make test-watch    - Run tests in watch mode"
	@echo "  make test-ui       - Run tests with UI (http://localhost:51204)"
	@echo "  make test-e2e      - E2E only (all browser projects)"
	@echo "  make test-e2e-fast - E2E Chromium desktop only"
	@echo "  make test-unit     - Unit/integration (Vitest) only"
	@echo "  make test-coverage - Run tests with coverage"
	@echo "  make build         - Build Docker image"
	@echo "  make update-lockfile - Update pnpm lockfile (if build fails)"
	@echo "  make clean         - Clean up Docker resources"
	@echo ""
	@echo "pnpm: test:local:fast (same as make test-fast) vs test:local:extensive (same as make test)"
	@echo ""
	@echo "Note: All tests run in Docker by default for consistency."
	@echo "For local execution (not recommended), use: pnpm test:local:*"
