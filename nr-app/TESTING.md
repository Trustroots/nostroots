# nr-app Testing

This app uses a layered test strategy:

- Jest unit tests for services, reducers, sagas, Nostr helpers, and utilities.
- React Native Testing Library for screen and component behavior.
- Maestro for installed-app smoke and critical E2E flows.
- A deterministic local E2E network for bridge, email, and relay behavior.

Required/repeatable tests must never depend on live Trustroots, public Nostr
relays, or real email delivery.

## Local Commands

Run the app test suite:

```bash
pnpm --filter nr-app test
```

Run coverage as CI does:

```bash
pnpm --filter nr-app test:ci
```

Run coverage locally without CI mode:

```bash
pnpm --filter nr-app test:coverage
```

Run one test file:

```bash
pnpm --filter nr-app test -- app/onboarding/trustroots.test.tsx
```

## Test Helpers

Shared Jest/RNTL helpers live in `src/test/`.

- `renderWithProviders()` renders components with a test Redux store.
- `createTestStore()` creates a non-persisted store with app slices.
- `router.ts` controls `expo-router` path, params, and navigation spies.
- `secureStoreMock.ts` controls deterministic SecureStore state.
- `nostrMocks.ts` provides relay, publish, signing, and subscription mocks.
- `fetch.ts` provides deterministic JSON fetch helpers.

Use these helpers rather than importing the production store singleton in
component tests.

## Coverage

Coverage is configured in `jest.config.js`.

Coverage includes `app/**/*.{ts,tsx}` and `src/**/*.{ts,tsx}`. Exclusions are
limited to files that are generated, type-only, configuration-only, or native
wrappers better validated by installed-app E2E tests.

Initial thresholds are pinned near the current baseline and should be increased
as coverage grows. When a file is excluded, keep the exclusion narrow and explain
why it is not meaningful to test directly.

## E2E Hooks

E2E-only reset and seed routes are gated by:

```bash
EXPO_PUBLIC_E2E=1
```

Available routes:

- `nostroots://e2e/reset`
- `nostroots://e2e/seed?scenario=pending-verify`

When `EXPO_PUBLIC_E2E` is not `1`, these routes redirect to `/` and do not run
reset or seed behavior. Do not expose E2E hooks through normal visible UI.

## Local E2E Network

Start deterministic E2E services:

```bash
docker compose -f nr-app/e2e/docker-compose.yml up -d --build
```

Stop and clear them:

```bash
docker compose -f nr-app/e2e/docker-compose.yml down -v
```

Services:

- `mongodb`: seeded Trustroots users.
- `nr-bridge`: local verification service.
- `mailpit`: local SMTP and email UI.
- `tiny-relay`: deterministic in-process Nostr WebSocket relay.

Tiny relay:

```bash
deno task --config development-utils/local-relay/deno.jsonc run-tiny
```

Admin endpoints:

- `POST http://localhost:7777/__admin/reset`
- `POST http://localhost:7777/__admin/seed`
- `GET http://localhost:7777/__admin/events`
- `GET http://localhost:7777/__admin/subscriptions`
- `POST http://localhost:7777/__admin/actions`

Use `10.0.2.2` from Android emulator and `127.0.0.1` from iOS simulator.

## EAS Profiles

E2E profiles are defined in `eas.json`:

- `e2e-android`
- `e2e-ios-simulator`

They set:

- `EXPO_PUBLIC_E2E=1`
- `EXPO_PUBLIC_NR_BRIDGE_BASE_URL`
- `EXPO_PUBLIC_NOSTR_RELAYS`

E2E builds must not require production secrets.

## GitHub Actions And Secrets

Required repository secret:

- `EXPO_TOKEN`: used by EAS build workflows and Android Maestro artifact builds.

Optional, if enabling hosted Maestro Cloud beyond the EAS workflow:

- `MAESTRO_CLOUD_API_KEY`
- Maestro project identifier if required by the selected EAS/Maestro integration.

GitHub workflows:

- `nr-app-unit.yml`: lint and Jest/RNTL coverage artifact.
- `ci-nr-app.yml`: PR and main branch app CI.
- `nr-app-e2e-maestro.yml`: Android Maestro PR E2E on Ubuntu/emulator.
- `.eas/workflows/nr-app-ios-maestro-smoke.yaml`: EAS-run iOS simulator smoke.

## Migration Guide

From a fresh checkout:

1. Run `pnpm install`.
2. Run `pnpm --filter nr-app test:ci`.
3. Start the E2E network with Docker Compose.
4. Build an Android E2E APK with `pnpm --filter nr-app build:android-e2e`.
5. Install the APK on an emulator.
6. Run a Maestro smoke flow from `nr-app/.maestro`.
7. Configure `EXPO_TOKEN` in GitHub repository secrets.
8. Confirm EAS has access to the project and can build `e2e-android`.
9. Open a PR touching `nr-app/**` and verify unit coverage and Android Maestro.
10. Enable or validate the EAS iOS Maestro smoke workflow.

If a new CI job unexpectedly blocks work, disable the workflow trigger or remove
the required branch protection check while debugging. Do not replace deterministic
local services with live production services.

## Troubleshooting

Jest transform errors:

- Add ESM React Native packages to `transformIgnorePatterns`.
- Prefer targeted mocks for native modules.

Coverage failures:

- Add meaningful tests for the changed behavior.
- Do not broaden exclusions unless the file is genuinely not meaningful to test.

E2E network failures:

- Check `docker compose -f nr-app/e2e/docker-compose.yml logs`.
- Verify ports `8000`, `1025`, `8025`, and `7777`.

Platform URL mistakes:

- Android emulator uses `10.0.2.2`.
- iOS simulator uses `127.0.0.1`.

Maestro selector failures:

- Prefer `testID` selectors over visible copy and coordinates.
- Use Maestro Studio to inspect the installed app.

EAS artifact issues:

- Ensure the EAS profile is `e2e-android` or `e2e-ios-simulator`.
- Expired artifact URLs require rebuilding the profile.
