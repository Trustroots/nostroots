## ADDED Requirements

### Requirement: Native iOS product parity backlog

Native iOS Vibe apps MUST continue toward parity with current `nr-web` core
flows while preserving native iOS presentation patterns.

#### Scenario: Product behavior overlap

- **GIVEN** a native iOS flow overlaps with current `nr-web` behavior
- **WHEN** there is no strong native reason to differ
- **THEN** the native app SHOULD preserve the `nr-web` behavior.

#### Scenario: Deferred surfaces

- **GIVEN** a feature is Pixel or an extra experimental map layer
- **WHEN** defining v1 native iOS scope
- **THEN** the feature SHOULD remain out of scope unless explicitly promoted by
  a later change.
