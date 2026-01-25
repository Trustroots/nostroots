.PHONY: test test-watch test-ui test-e2e test-all build check-docker help

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

# Run all tests (default)
test: build
	@echo "Running all tests in Docker..."
	docker-compose run --rm tests

# Run tests in watch mode
test-watch: build
	@echo "Running tests in watch mode..."
	docker-compose run --rm tests pnpm test:local:watch

# Run tests with UI
test-ui: build
	@echo "Running tests with UI (accessible on http://localhost:51204)..."
	docker-compose run --rm -p 51204:51204 tests pnpm test:local:ui

# Run E2E tests only
test-e2e: build
	@echo "Running E2E tests in Docker..."
	docker-compose run --rm tests pnpm test:local:e2e

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
	@echo "  make test          - Run all tests (default)"
	@echo "  make test-watch    - Run tests in watch mode"
	@echo "  make test-ui       - Run tests with UI (http://localhost:51204)"
	@echo "  make test-e2e      - Run E2E tests only"
	@echo "  make test-unit     - Run unit/integration tests only"
	@echo "  make test-coverage - Run tests with coverage"
	@echo "  make build         - Build Docker image"
	@echo "  make update-lockfile - Update pnpm lockfile (if build fails)"
	@echo "  make clean         - Clean up Docker resources"
	@echo ""
	@echo "Note: All tests run in Docker by default for consistency."
	@echo "For local execution (not recommended), use: pnpm test:local:*"
