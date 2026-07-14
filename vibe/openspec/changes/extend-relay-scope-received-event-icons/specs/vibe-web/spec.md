## ADDED Requirements

### Requirement: Received map/chat relay-scope display

Vibe Web MUST display relay-scope indicators for received map notes and chat
messages only when explicit relay source metadata is available.

#### Scenario: Auth-only received event

- **GIVEN** a received event is known to have arrived only from auth-required
  relays
- **WHEN** the map note or chat row renders
- **THEN** Vibe Web MAY show the auth/private relay-scope indicator.

#### Scenario: Unknown received event

- **GIVEN** a received event has no source relay metadata
- **WHEN** the map note or chat row renders
- **THEN** Vibe Web MUST either show no relay-scope indicator or a neutral
  unknown affordance that does not imply public delivery.
