# Vibe Web

## Purpose

Define current behavior for the standalone Vibe Web static workspace, including
the root hub, `/v0/` Nostroots Web app, routing, relay/key behavior,
experiments, examples, and testing expectations.

## Requirements

### Requirement: Static web app structure

Vibe Web MUST remain a static web workspace that can be served without a build
step for the main pages.

#### Scenario: Root hub

- **GIVEN** a user opens the Vibe Web root page
- **WHEN** the page renders
- **THEN** it MUST act as a hub for Nostroots Web, background information,
  classic Trustroots network settings, app downloads, and optional experimental
  experiences.

#### Scenario: Current Nostroots Web app

- **GIVEN** a user opens `/v0/`
- **WHEN** the browser loads the app
- **THEN** the experience MUST provide the current map, chat, profile, keys,
  settings, stats, relay, and Trustroots-style activity flows.

### Requirement: Hash-based routing

Nostroots Web MUST use hash routing for current static-host compatibility.

#### Scenario: Reserved routes

- **GIVEN** a user navigates to `#keys`, `#settings`, or `#stats`
- **WHEN** the hash router classifies the route
- **THEN** it MUST open the corresponding modal or stats dashboard.

#### Scenario: Profile routes

- **GIVEN** a user navigates to `#profile`, `#profile/<npub-or-hex-or-nip05>`,
  or a supported `/edit` or `/contacts` suffix
- **WHEN** the hash router classifies the route
- **THEN** it MUST route to self profile, public profile, edit profile, contacts,
  or profile-invalid states according to the documented route shape.

#### Scenario: Map and chat fallback routes

- **GIVEN** a hash contains a full Open Location Code, an `npub`, a hex pubkey,
  a NIP-05 handle, or a circle/channel slug
- **WHEN** the route is classified
- **THEN** plus codes MUST open map-area context, direct identifiers MUST open
  chat/profile-appropriate contexts, and other non-reserved slugs MUST resolve
  as chat channel routes.

### Requirement: Relay and key behavior

Nostroots Web MUST support local keys, NIP-07 browser signing, relay settings,
NIP-42 authenticated relay reads/writes, and leak guards for secret key text.

#### Scenario: Default relays

- **GIVEN** a user has no custom relay settings
- **WHEN** Nostroots Web initializes relay settings
- **THEN** it SHOULD include `wss://nip42.trustroots.org`,
  `wss://relay.trustroots.org`, and `wss://relay.nomadwiki.org`.

#### Scenario: Private key leak guard

- **GIVEN** a user tries to place `nsec` or private-key-like material in a note
  or message
- **WHEN** the app validates the content
- **THEN** it MUST prevent accidental publication of the secret.

### Requirement: Web experiments and examples

Vibe Web MUST keep experimental pages separate from the current `/v0/` app while
allowing them to share Vibe protocol conventions.

#### Scenario: Nostrail web experiment

- **GIVEN** a user opens `/nostrail/`
- **WHEN** they use the foreground-only location-sharing prototype
- **THEN** it MUST rely on browser-provided signing/encryption and must not
  claim native background behavior.

#### Scenario: Nostroots Map prototype

- **GIVEN** a user opens `/nostroots-map/`
- **WHEN** the prototype initializes
- **THEN** it SHOULD present a map-first browser-native prototype with NIP-07
  signer detection.

#### Scenario: Examples

- **GIVEN** a user opens `/examples/`
- **WHEN** examples are listed or launched
- **THEN** each example MUST remain optional demo/fork material rather than a
  required current app surface.

### Requirement: Vibe Web testing guidance

Vibe Web tests MUST focus on high-value behavior and use Docker-first commands
for consistent local and CI feedback.

#### Scenario: Critical-path change

- **GIVEN** a change touches key handling, protocol behavior, routing, or other
  covered critical paths
- **WHEN** the change is prepared for merge
- **THEN** the contributor SHOULD run `make test-fast` or a narrower relevant
  test command from `vibe/web`.
