# Running Tests for nr-web

## Docker-First Approach

**All tests should be run in Docker by default.** This ensures:
- Consistent environment across all developers
- Same Node.js version
- Proper system dependencies for Playwright
- Isolated test execution
- Reproducible results

## Quick Start

```bash
# From the nr-web directory
make test
```

This will:
1. Build the Docker image (if needed)
2. Run all tests (unit, integration, and E2E)
3. Clean up the container after completion

## Available Commands

### Using Make (Recommended)

```bash
make test          # Run all tests
make test-watch    # Watch mode for development
make test-ui       # Run with Vitest UI (http://localhost:51204)
make test-e2e      # E2E tests only
make test-unit     # Unit/integration tests only
make test-coverage # Run with coverage report
make build         # Build Docker image manually
make clean         # Clean up Docker resources
make help          # Show all commands
```

### Using Docker Compose Directly

```bash
# Run all tests
docker-compose run --rm tests

# Run specific test suite
docker-compose run --rm tests pnpm test:local
docker-compose run --rm tests pnpm test:local:e2e

# Watch mode
docker-compose run --rm tests pnpm test:local:watch

# With UI
docker-compose run --rm -p 51204:51204 tests pnpm test:local:ui
```

## Local Execution (Not Recommended)

If you must run tests locally (not recommended):

```bash
# Install dependencies
pnpm install

# Run tests locally
pnpm test:local
pnpm test:local:watch
pnpm test:local:e2e
```

**Warning**: Local execution may have issues:
- Missing Playwright system dependencies
- Different Node.js versions
- Platform-specific behavior differences
- Environment variable differences

## CI/CD Integration

In CI environments, tests automatically run in Docker:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    cd nr-web
    make test
```

## Troubleshooting

### Docker image won't build - Lockfile outdated

If you see an error about `pnpm-lock.yaml` being outdated:

```bash
# Update the lockfile in the monorepo root
cd ..
pnpm install
cd nr-web

# Then rebuild
make build
```

Or use the convenience command:
```bash
make update-lockfile
make build
```

### Docker image won't build - Other issues
```bash
# Clean and rebuild
make clean
make build
```

### Tests fail in Docker but work locally
This is expected - Docker is the source of truth. Fix the tests to work in Docker.

### Permission issues
```bash
# Clean volumes
make clean
```

### Port conflicts
If port 8080 or 51204 are in use, modify `docker-compose.yml` to use different ports.
