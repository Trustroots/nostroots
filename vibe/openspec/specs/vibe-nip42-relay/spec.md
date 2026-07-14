# Vibe NIP-42 Relay

## Purpose

Define current behavior for the Vibe NIP-42 auth gate, Trustroots identity
authorization, private upstream relay proxying, and optional ingestor sidecar.

## Requirements

### Requirement: Authenticated relay gate

The Vibe NIP-42 relay MUST accept public WebSocket clients while rejecting reads
and writes until the client authenticates with a valid NIP-42 event.

#### Scenario: Initial challenge

- **GIVEN** a client opens a WebSocket connection
- **WHEN** the connection is accepted
- **THEN** the relay MUST send an `AUTH` challenge.

#### Scenario: Unauthenticated request

- **GIVEN** a client has not completed authentication
- **WHEN** it sends `REQ` or `EVENT`
- **THEN** the relay MUST reject the action.

#### Scenario: Authenticated publish ownership

- **GIVEN** a client has authenticated as a pubkey
- **WHEN** it publishes an event signed by a different pubkey
- **THEN** the relay MUST reject the event.

### Requirement: Trustroots identity authorization

The relay MUST authorize authenticated pubkeys by verifying a linked Trustroots
identity through supported profile events and Trustroots NIP-05 resolution.

#### Scenario: Profile lookup

- **GIVEN** a valid kind `22242` auth event
- **WHEN** the relay checks authorization
- **THEN** it MUST look for a Trustroots username through kind `10390` or kind
  `0` profile data and verify that username through the configured Trustroots
  NIP-05 endpoint.

#### Scenario: Auth cache

- **GIVEN** a pubkey has passed authorization
- **WHEN** a later connection authenticates before the configured cache TTL
  expires
- **THEN** the relay MAY reuse the successful authorization cache.

### Requirement: Upstream strfry isolation

The NIP-42 relay MUST proxy allowed traffic to the configured upstream strfry
relay while keeping the upstream relay private in production.

#### Scenario: Compose stack

- **GIVEN** the local compose stack starts
- **WHEN** services are ready
- **THEN** public clients SHOULD connect to the NIP-42 relay service, not
  directly to the internal strfry service.

### Requirement: Ingestor sidecar

The local relay stack MUST support a `nostr-ingestor` sidecar that bridges
external sources to Nostr when configured with a valid signing key.

#### Scenario: Minimal ingestor configuration

- **GIVEN** the sidecar has no `NSEC`
- **WHEN** the stack runs
- **THEN** bridge publishing MUST be disabled or fail configuration rather than
  publishing unsigned events.

#### Scenario: Optional source tokens

- **GIVEN** GitHub or Matrix tokens are absent
- **WHEN** the sidecar starts
- **THEN** polling for the missing source MAY be disabled while other configured
  sources continue.
