## ADDED Requirements

### Requirement: Received-event relay source metadata

Vibe clients MUST use explicit source metadata before displaying relay-scope
icons for received events.

#### Scenario: Relay URL known

- **GIVEN** a subscription callback includes the relay URL that delivered an
  event
- **WHEN** the client derives relay-scope display metadata
- **THEN** it MAY classify the display scope from that relay URL.

#### Scenario: Relay URL unknown

- **GIVEN** no relay URL or equivalent source signal exists for a received event
- **WHEN** the UI renders relay-scope metadata
- **THEN** it MUST NOT display the event as public by default.
