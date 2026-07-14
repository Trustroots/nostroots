## ADDED Requirements

### Requirement: Circle-scoped web app mode

Vibe Web MUST support a circle-scoped mode that reuses the current `/web/` app
while filtering map-note behavior to one Trustroots circle.

#### Scenario: Circle URL

- **GIVEN** a user opens `/web/?circle=<slug>`
- **WHEN** the slug is supported
- **THEN** Vibe Web MUST select that circle, hide generic circle switching where
  appropriate, and update user-facing title/header text.

#### Scenario: Circle subscription filter

- **GIVEN** circle mode is active
- **WHEN** the app subscribes to map notes
- **THEN** map-note subscriptions MUST include `trustroots-circle` label filters
  for the selected slug.

### Requirement: Generated circle pages

Vibe Web MUST provide a generation path for static circle URLs.

#### Scenario: Generated redirect

- **GIVEN** a supported circle exists in the circle config
- **WHEN** the generator runs
- **THEN** it MUST create a static page that routes users to the corresponding
  `/web/?circle=<slug>` app view.
