## ADDED Requirements

### Requirement: Clean URL hosting support

Vibe Web MUST support clean path-style URLs only when the hosting layer rewrites
app paths to the static app with successful HTTP responses.

#### Scenario: Direct clean URL visit

- **GIVEN** clean URL support is enabled
- **WHEN** a user directly visits `/stats` or `/profile/<id>`
- **THEN** the host MUST return the app with HTTP 200 and the client MUST route
  to the equivalent current view.

#### Scenario: Hash compatibility

- **GIVEN** an existing hash URL is opened
- **WHEN** clean URL support exists
- **THEN** the hash URL MUST continue to work.
