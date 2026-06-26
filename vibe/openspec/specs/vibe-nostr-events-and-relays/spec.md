# Vibe Nostr Events And Relays

## Purpose

Define the Nostr event, relay, identity, and signing expectations shared by
Vibe Web, browser shells, relay tooling, import tooling, and push workflows.

## Requirements

### Requirement: Trustroots map-note trust model

Vibe clients MUST distinguish user-authored map notes (`30397`) from
validated/mirrored map notes (`30398`) while preserving the existing product
rule that `30397` events received through `wss://nip42.trustroots.org` are
Trustroots-scoped because relay access is gated by Trustroots identity.

#### Scenario: Public relay validation path

- **GIVEN** a user-authored map note is published as kind `30397`
- **WHEN** the validation service approves and republishes it
- **THEN** clients MAY treat the resulting kind `30398` event as
  Trustroots-validated.

#### Scenario: NIP-42 relay scoped path

- **GIVEN** a kind `30397` event is read from `wss://nip42.trustroots.org`
- **WHEN** the client has authenticated through NIP-42 for that relay
- **THEN** the client MUST treat the event as Trustroots-scoped product content,
  not as an arbitrary public-relay `30397`.

### Requirement: Relay-scope display metadata

Vibe clients MUST treat `relayScope` as client-local metadata, not as a Nostr
event field or validation proof.

#### Scenario: Scope can be derived from successful publish URLs

- **GIVEN** a publish action succeeds on one or more relay URLs
- **WHEN** at least one successful URL is a known public relay
- **THEN** the event display metadata MAY use `relayScope: "public"`.

#### Scenario: Unknown incoming scope remains unknown

- **GIVEN** a relay subscription delivers a plain Nostr `EVENT`
- **WHEN** the event object has no valid `relayScope`
- **THEN** the UI MUST NOT default the relay-scope pill or icon to public.

### Requirement: Trustroots profile and circle metadata import events

Vibe clients MUST support imported Trustroots profile and circle metadata events
signed by the configured Trustroots import key.

#### Scenario: Imported profile claim

- **GIVEN** a kind `30390` event includes a hex `p` tag for a user's Nostr
  pubkey
- **WHEN** its content includes Trustroots profile fields such as `nip05`,
  `trustrootsUsername`, `picture`, `languages`, `livesIn`, or `from`
- **THEN** Vibe clients MAY use those fields to enrich public profile display.

#### Scenario: Circle metadata directory

- **GIVEN** a kind `30410` event has `d`, `L`, and `l` tags for a
  `trustroots-circle` slug
- **WHEN** the event author matches the trusted import pubkey
- **THEN** Vibe clients MAY use its JSON `name`, `about`, and `picture` content
  for circle-scoped UI.

### Requirement: Browser signing interfaces

Vibe browser surfaces MUST interoperate with NIP-07 style signing providers for
public-key lookup, event signing, and encrypted messaging capabilities used by
Nostroots.

#### Scenario: NIP-42 authentication signing

- **GIVEN** a relay sends an `AUTH` challenge
- **WHEN** a Vibe client signs a kind `22242` auth event
- **THEN** the event MUST include the challenge and relay URL tags expected by
  the relay.

#### Scenario: Encrypted payload support

- **GIVEN** a Vibe feature requires encrypted direct messaging or location
  sharing
- **WHEN** the browser signer is used for that feature
- **THEN** the signer MUST expose the NIP-44 and/or legacy NIP-04 methods that
  the feature requires.
