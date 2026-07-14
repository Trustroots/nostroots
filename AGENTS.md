# Nostroots — agent guidance

Cross-tool guidance for AI agents working in this repository.

**nr-web** is the informal name for the Nostroots web app; it lives at `vibe/web/`. Use `vibe/web/` for paths, commands, and links; either name is fine in prose.

## Project Overview

Nostroots is a decentralized social network for travelers and hosts, transitioning Trustroots onto the Nostr protocol. The project consists of multiple components working together to enable location-based social interactions on Nostr relays.

**Live web version:** https://nos.trustroots.org/

## Monorepo Structure

This is a pnpm workspace monorepo with the core app stack and an isolated Vibe stack:

- **nr-app** - React Native mobile app (Expo) for iOS/Android
- **nr-common** - Shared TypeScript/Deno library used by all components
- **nr-server** - Deno-based validation and reposting service
- **nr-push** - Go-based push notification service
- **vibe/web** - Standalone HTML/CSS/JS web application (informally **nr-web**)
- **vibe/browser** - Nostroots Browser, with the native iOS app under `vibe/browser/ios` and the desktop extension under `vibe/browser/extension`
- **vibe/nip42relay** - Vibe NIP-42 relay and Trustroots import tooling
- **vibe/push-notification-daemon** - Vibe-only APNs push daemon for native browser notifications

## Essential Commands

### Monorepo
```bash
pnpm i                    # Install all dependencies (run at root)
```

### nr-app (Mobile App)
```bash
cd nr-app
pnpm i                    # Install dependencies
pnpm start                # Start Expo dev server (use Expo Go or dev build)
pnpm run android          # Run on Android emulator
pnpm run ios              # Run on iOS simulator (macOS only)
pnpm test                 # Run tests in watch mode
pnpm lint                 # Run ESLint

# EAS (Expo Application Services) builds
pnpm build:android-development
pnpm build:ios-development
pnpm build:ios-simulator
pnpm build:android-preview
pnpm build:ios-production
```

### vibe/web (Web App)
```bash
cd vibe/web
make test-fast           # Fast: Vitest + Playwright Chromium (use before merge or when touching critical paths)
make test                # Full: all Playwright projects (CI-parity, slower)
make test-watch          # Run tests in watch mode
make test-e2e            # Run end-to-end tests only (all projects)
make test-e2e-fast       # E2E Chromium only
make test-ui             # Run tests with UI on http://localhost:51204

# Local testing (not recommended, use Docker instead)
pnpm install
pnpm test:local
pnpm test:local:fast
```

For vibe/web browser checks, use the existing local server at `http://localhost:30397/` when available instead of starting another static server.

See **Testing Philosophy** below: do not treat full test runs or broad test updates as mandatory on every nr-web edit.

When changing first-impression UX or onboarding copy in `vibe/web`, follow `vibe/docs/STYLE_GUIDE.md`.

### nr-common (Shared Library)
```bash
cd nr-common
deno task build          # Build for npm (outputs to build/)
cd .. && pnpm i          # Install in workspace after build
```

## Architecture

### High-Level Data Flow

```
User creates note → nr-app signs & publishes (kind 30397)
→ Nostr relays → nr-server validates Trustroots identity
→ nr-server reposts as kind 30398 → All clients see validated note
```

### nr-app Architecture

**Framework:** Expo (React Native) with Expo Router for file-based navigation

**State Management:** Redux Toolkit + Redux-Saga
- **Redux slices:** events, keystore, relays, map, settings, notifications
- **Sagas:** Handle Nostr subscriptions, publishing, map updates, notifications
- Redux state persists to device storage via redux-persist

**Nostr Integration:**
- Uses nostr-tools for protocol implementation
- Private keys stored in Expo SecureStore (device keychain)
- Supports NIP-06 (mnemonic keys), NIP-19 (nsec/npub), NIP-46 (remote signing)
- Real-time subscriptions to relays for map events

**Key Directories:**
- `app/` - Expo Router screens (tabs, onboarding)
- `src/redux/` - State management (slices, sagas, actions)
- `src/nostr/` - Nostr protocol integration
- `src/components/` - React components (Map, NotesList, forms)

**Geographic Indexing:** Uses Open Location Code (Plus Codes) for efficient map-based queries

### nr-common Library

**Purpose:** Shared code for event schemas, validation, and utilities

**Key Exports:**
- **Event schemas:** Zod schemas for Nostr event kinds (10390, 10395, 30397, 30398)
- **Validation:** `isValidEvent()`, hex key validation, plus code validation
- **Utilities:** Label/tag helpers, plus code operations, NIP-05 lookup
- **Constants:** Event kinds, relay URLs, server pubkeys, map layers config

**Build:** Deno-based, compiles to npm-compatible ESM modules

### nr-server Validation Service

**Purpose:** Validates user identity and reposts approved events

**Flow:**
1. Receives kind 30397 events (via AMQP queue or relay subscription)
2. Validates user has NIP-05 identity on trustroots.org
3. Reposts as kind 30398 with server signature
4. Published to Nostr relays for all clients

**Tech:** Deno + TypeScript, uses nostr-tools and nostrify

### vibe/web Web Application

**Architecture:** Multi-page static site (no bundler): HTML entry points plus shared JS/CSS modules. The main hash-routed app lives in `vibe/web/v0/index.html` and `vibe/web/v0/index.js`.
- Uses Leaflet for maps
- Supports NIP-07 browser extensions
- Compatible with nr-app event formats via nr-common schemas

**Editing guardrails (v0 hash-page):** `vibe/web/v0/index.html` is parsed as inline scripts and is sensitive to malformed conditional expressions. Prefer explicit `if/else` for multi-branch selection over deeply nested ternaries to avoid `missing : in conditional expression` parser failures (this can break `#welcome` and other hash routes). After editing, run:

```bash
node --check vibe/web/v0/index.js
```

**Testing:** Vitest + Playwright in Docker when you run the suite; coverage is intentionally pragmatic while the UI evolves (see Testing Philosophy)

**Vibe OpenSpec:** When a change under `vibe/` alters product or protocol behavior (web hub, browser shell, relay, push, import tooling, etc.), update the matching capability spec in `vibe/openspec/specs/` so documented behavior stays in sync. See `vibe/openspec/project.md` for layout and style. For in-flight proposals, use `vibe/openspec/changes/<change-id>/`; for shipped behavior, edit the baseline spec directly.

## Development Workflows

### Committing Changes

When the **user asks you to commit**, repo convention allows skipping pre-commit hooks for scoped changes (husky runs ESLint on `nr-app`, which can fail for unrelated reasons). Do not commit or use `--no-verify` unless the user explicitly requests a commit.

**vibe/web (nr-web):** When committing changes that only affect `vibe/web/`:
- The web app is standalone static HTML/JS and does not use the same tooling as `nr-app`
- Pre-commit hooks run ESLint on `nr-app`, which can fail for unrelated reasons
- See `vibe/web/README.md` for more details

```bash
git commit --no-verify -m "Your commit message"
```

When committing changes under `vibe/web/` (especially `vibe/web/index.html` or `vibe/web/v0/index.html`), be verbose about product behavior:
- Include specific details about what functionality was added, modified, or fixed
- Optionally reference related test files if they clarify behavior (the UI is still moving quickly; tests are not the primary changelog)

**nr-app:** Hooks will run ESLint automatically. Fix issues before committing.

**Workflows (`.github/workflows/`):** When committing changes that only affect GitHub workflows:
- Workflow files are YAML configuration and do not need ESLint validation
- Pre-commit hooks run ESLint on `nr-app`, which can fail for unrelated reasons

```bash
git commit --no-verify -m "Your commit message"
```

### Working with nr-common

After making changes to nr-common:
```bash
cd nr-common
deno task build    # Compile to npm modules
cd ..
pnpm i            # Update workspace dependencies
```

### Testing Philosophy

**vibe/web (nr-web):** The stack is still in flux: prioritize product behavior and clear code over heavy test churn.
- Follow `vibe/docs/STYLE_GUIDE.md` for first-impression UX copy and lightweight visual guidance
- Add or keep tests for **important** behavior (security-sensitive flows, tricky parsing, regressions you care about), not for every UI tweak
- Do **not** spend large amounts of time running, rewriting, or expanding the suite on every small change; avoid blocking iteration on test-framework maintenance
- When you do run tests (e.g. before merge or after touching critical paths), use Docker — see `vibe/web/tests/README.md`. Quick check: `make test-fast` from `vibe/web`; full matrix: `make test`

Keep tests for **high-value** areas (e.g. key handling, protocol or routing edge cases, bugs you do not want back). Do **not** default to expanding or rewriting the suite on every change. Run `make test-fast` (Docker) when you have touched critical logic or before merge/CI if your change could break covered flows.

**nr-web stats/date copy:** On the `#stats` dashboard and similar operational/progress UI, format timestamps as `yyyy-mm-dd hh:mm` (for example `2026-05-13 11:42`) instead of locale phrases such as `May 13, 11:42 AM`.

**nr-app:** Tests use jest-expo preset; follow normal app testing discipline there.

### Nostr Standards

When implementing Nostr features, refer to the official NIPs (Nostr Implementation Possibilities) repository:
- https://github.com/nostr-protocol/nips

## Custom Nostr Event Kinds

| Kind | Purpose | Schema |
|------|---------|--------|
| 10390 | Trustroots Profile | Includes trustroots username tag |
| 10395 | Notification Subscriptions | Geographic notification preferences |
| 30397 | Unverified Map Notes | User-submitted location-based notes |
| 30398 | Verified Map Notes | Server-validated reposts of 30397 |

## Map Layers

The app supports 6 configurable map layers (defined in nr-common):
- Trustroots (verified notes from validation server)
- Hitchmap, Hitchwiki, Time Safari (external sources)
- Trip Hopping (test data)
- Unverified (user-submitted)

Each layer has distinct marker colors and Nostr filters.

## Key Technical Patterns

**Plus Code Geographic Indexing:** Events tagged with Open Location Codes enable efficient spatial queries without revealing exact coordinates until viewed.

**Event-Driven Architecture:** Map viewport changes trigger subscription updates via Redux actions → sagas → Nostr subscriptions.

**Validation via Reposting:** nr-server acts as trusted curator by signing approved events, allowing clients to filter for quality.

**Offline-First:** Redux-persist caches events locally, enabling map browsing without connectivity.

## Platform-Specific Notes

**iOS Development:** Requires macOS with Xcode installed.

**Android Development:** Android Studio provides emulator support. Install via `brew install android-studio` on macOS, use `~/Library/Android`.

**Expo Go vs Dev Builds:** Expo Go is fastest for getting started. Development builds required for native modules testing.

## Production Deployments

**Mobile App Releases:**
- Preview builds: Run "Build in EAS Cloud" GitHub action with `android-preview`
- OTA updates to preview: `eas update --channel preview --message "message"`
- Production iOS: `pnpm build:ios-production` (auto-submits to App Store)

**Web Deployment:** Static files at https://nos.trustroots.org/ (GitHub Pages)

## Troubleshooting

**Expo Go not connecting:** Ensure laptop and phone are on same network. Disable VPNs.

**EAS build expired:** Run GitHub action workflow "Build in EAS Cloud" manually or run build commands locally.

**nr-web test failures:** Reproduce in Docker (`make test-fast` or `make test` from `vibe/web`) when debugging failures; local runs can differ. If a failure is brittle or low-value while the feature is experimental, fixing the product or skipping/deleting an obsolete test can be acceptable—prefer judgment over exhaustive maintenance.

**pnpm workspace issues:** Run `pnpm i` at root after making changes to nr-common.
