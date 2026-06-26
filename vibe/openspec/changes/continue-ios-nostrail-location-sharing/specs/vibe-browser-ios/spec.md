## ADDED Requirements

### Requirement: Native Nostrail hardening

Nostrail MUST continue hardening temporary encrypted location sharing without
expanding into unrelated Nostroots product surfaces.

#### Scenario: Approximate encrypted sharing

- **GIVEN** a user shares location with one or more recipients
- **WHEN** the app publishes sharing updates
- **THEN** it SHOULD send approximate, expiration-bound, NIP-44 encrypted events
  to each recipient separately.

#### Scenario: Active sharing key lifecycle

- **GIVEN** an active sharing session exists
- **WHEN** the user tries to clear or replace the key
- **THEN** the app SHOULD block replacement until the session is stopped or
  safely recovered.
