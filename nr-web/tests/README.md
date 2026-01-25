# nr-web Tests

Simple, effective, and easily expandable test framework for nr-web.

**⚠️ IMPORTANT: Tests are designed to run in Docker by default for consistency and safety.**

## Quick Start (Docker - Recommended)

```bash
# Run all tests (builds image if needed)
make test

# Or use docker-compose directly
docker-compose run --rm tests

# Run tests in watch mode
make test-watch

# Run tests with UI
make test-ui
# Then open http://localhost:51204

# Run E2E tests only
make test-e2e

# Run with coverage
make test-coverage
```

## Local Execution (Not Recommended)

Local execution is discouraged but available if needed:

```bash
# Install dependencies first
pnpm install

# Run tests locally (bypasses Docker)
pnpm test:local
pnpm test:local:watch
pnpm test:local:e2e
```

**Note**: Local execution may have inconsistencies due to:
- Different Node.js versions
- Missing system dependencies for Playwright
- Different environment variables
- Platform-specific behavior

Use Docker for consistent, reproducible test results.

## Test Structure

- `unit/` - Unit tests for pure functions (key management, utilities)
- `integration/` - Integration tests for DOM interactions (modals, forms)
- `e2e/` - End-to-end tests in real browser (full workflows)
- `setup.js` - Test setup (loads HTML, sets up mocks)
- `helpers.js` - Reusable test utilities
- `server.js` - Simple HTTP server for E2E tests

## Running in Docker

```bash
# Build test image
docker build -t nr-web-tests -f Dockerfile .

# Run tests
docker run --rm nr-web-tests

# Or run specific test suite
docker run --rm nr-web-tests pnpm test
docker run --rm nr-web-tests pnpm test:e2e
```

## Adding New Tests

1. **Unit tests**: Add to `unit/` directory
   - Test functions via `window` object
   - Example: `window.generateKeyPair()`

2. **Integration tests**: Add to `integration/` directory
   - Test DOM interactions
   - Example: Modal open/close, form submissions

3. **E2E tests**: Add to `e2e/` directory
   - Test full user workflows
   - Example: Onboarding flow, note posting

## Notes

- Tests run against the actual `index.html` file (no refactoring needed)
- CDN imports are mocked in unit/integration tests
- E2E tests use real browser (Playwright)
- All browser APIs are mocked appropriately for test environment
