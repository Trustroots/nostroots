## ADDED Requirements

### Requirement: Public plus-code subscription aggregates

The notification daemon MUST publish public aggregate stats events derived from
encrypted subscription events without exposing raw subscription payloads.

#### Scenario: Aggregate event

- **GIVEN** valid kind `10395` subscription events include map-note plus-code
  filters
- **WHEN** subscription state changes for a plus code
- **THEN** the daemon MUST publish a parameterized replaceable aggregate event
  for that plus code with total and client-split counts.

#### Scenario: Legacy client tag

- **GIVEN** a valid kind `10395` event has no `client` tag
- **WHEN** the daemon computes client breakdowns
- **THEN** it MUST treat that subscriber as `nr-app` by default.
