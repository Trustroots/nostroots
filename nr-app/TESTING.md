# nr-app testing

The app uses three layers of tests:

- Jest for utilities, reducers, sagas, services, and Nostr boundaries.
- React Native Testing Library for components and routes.
- Maestro for a small installed-app smoke flow on Android and iOS.

Tests must not depend on production Trustroots services, public Nostr relays,
real email delivery, or a developer's persisted app state.

## Jest

From the repository root:

```bash
pnpm --filter nr-app test
pnpm --filter nr-app test:watch
pnpm --filter nr-app test:coverage
pnpm --filter nr-app test:ci
pnpm --filter nr-app typecheck
```

The typecheck command currently reports pre-existing application errors and is
therefore diagnostic rather than a required CI gate. Promote it into CI once
that baseline has been cleared.

`test:ci` is the authoritative unit-test command. It runs the complete suite in
one Jest process, collects coverage across `app/` and `src/`, and enforces the
thresholds in `jest.config.js`.

Shared stateful mocks and Redux render helpers live in `src/test/`. Mutable
native state, AsyncStorage, SecureStore, and router calls are reset before every
test. Prefer mocking network, native, and relay boundaries while retaining real
reducers and user-visible component behavior.

## Deterministic E2E services

Start the local network:

```bash
docker compose -f nr-app/e2e/docker-compose.yml up -d --build --wait
```

It provides MongoDB, Mailpit, nr-bridge, and an in-process Nostr relay. Stop and
clear it with:

```bash
docker compose -f nr-app/e2e/docker-compose.yml down -v
```

The relay listens on port 7777 and exposes deterministic admin endpoints:

- `POST /__admin/reset`
- `POST /__admin/seed`
- `GET /__admin/events`
- `GET /__admin/subscriptions`
- `POST /__admin/actions`

Android emulators access host services through `10.0.2.2`; iOS simulators use
`127.0.0.1`.

## E2E builds and Maestro

E2E-only app routes are enabled only when `EXPO_PUBLIC_E2E=1`:

- `nostroots://e2e/reset`
- `nostroots://e2e/seed?scenario=pending-verify`

Without that flag the routes redirect to `/` and cannot clear or seed state.

Useful commands:

```bash
pnpm --filter nr-app build:android-e2e-local
pnpm --filter nr-app test:maestro:local -- .maestro/main-map-smoke.yaml

pnpm --filter nr-app ios:e2e:simulator:reset
pnpm --filter nr-app build:ios-e2e-local
pnpm --filter nr-app test:maestro:ios:local -- .maestro/main-map-smoke.yaml
```

The GitHub E2E workflow runs the short Android smoke flow for relevant pull
requests. iOS is intentionally opt-in because of macOS runner cost and native
build time; add the `ios-e2e` label or dispatch the workflow manually. Adding or
removing that label does not rerun Android.

Failed E2E runs retain logs, Maestro output, and the Android APK for seven days.
Successful runs do not upload large diagnostic artifacts.

## Selector and scenario guidance

- Prefer stable `testID` selectors from `src/constants/testIds.ts`.
- Keep the automatic flow short and limited to startup plus primary navigation.
- Put broader account, bridge, and publishing scenarios in separate Maestro
  flows that can run manually or on a schedule.
- Make startup conditional so flows tolerate welcome, onboarding, and already
  initialized states.
- Never test an unversioned "latest" EAS artifact. Any reused build must be
  associated with the exact source commit under test.
