# Trustroots Import Tool

## Purpose

Define current behavior for importing Trustroots Mongo data into Nostr event
lines consumed by Vibe Web, relay tooling, and Trustroots-scoped clients.

## Requirements

### Requirement: Phased Trustroots export

The import tool MUST export eligible Trustroots data into deterministic Nostr
event lines using the configured signing key.

#### Scenario: Export phases

- **GIVEN** the tool connects to MongoDB with eligible users and related data
- **WHEN** an export run starts
- **THEN** it SHOULD emit profile claims, host mirror events, relationship
  claims, experience claims, thread upvote metrics, and circle metadata in the
  documented phases.

#### Scenario: Signing key

- **GIVEN** the operator provides `-nsec`
- **WHEN** the tool creates events
- **THEN** generated events MUST be signed by the corresponding import key.

### Requirement: Imported profile claims

The tool MUST preserve Trustroots profile fields and circle membership tags in
kind `30390` profile claim events.

#### Scenario: Profile field mapping

- **GIVEN** an eligible Trustroots user has profile fields
- **WHEN** a kind `30390` claim is generated
- **THEN** content SHOULD include supported fields such as name, display name,
  about, picture, NIP-05, Trustroots username, gender, member-since, location,
  and language data when available.

#### Scenario: Circle membership tags

- **GIVEN** the user belongs to public Trustroots circles
- **WHEN** the profile claim is generated
- **THEN** the event SHOULD include the same `L`, `l`, and `t` circle tags used
  by host mirror events.

### Requirement: Host mirror and plus-code mapping

The tool MUST map host/location records into Nostr events using repo-compatible
plus-code and Trustroots circle tag conventions.

#### Scenario: Plus-code prefixes

- **GIVEN** a host record has a location
- **WHEN** map note mirror events are generated
- **THEN** the tool MUST derive plus-code labels at the supported granularity
  used by Vibe clients.

#### Scenario: Circle slug normalization

- **GIVEN** a Trustroots tribe slug contains ASCII hyphens
- **WHEN** it is written to Nostr circle tags
- **THEN** the tag slug MUST be normalized to the hyphen-free
  `trustroots-circle` identifier expected by clients.

### Requirement: State and idempotency

The import tool MUST keep enough state to avoid re-emitting stale or duplicate
claims unexpectedly.

#### Scenario: State file

- **GIVEN** a prior import state exists
- **WHEN** the next import run starts
- **THEN** the tool SHOULD use that state to decide whether to emit updates or
  deletions for changed Trustroots records.

#### Scenario: Repeatable output

- **GIVEN** source data and configuration are unchanged
- **WHEN** the import runs again
- **THEN** generated event semantics SHOULD remain stable for downstream relay
  replacement and client display.
