## ADDED Requirements

### Requirement: Render plus-code subscription stats

Vibe Web MUST subscribe to daemon-published plus-code aggregate stats and render
them near the subscribe/unsubscribe control.

#### Scenario: Stats available

- **GIVEN** a latest aggregate stats event exists for the current plus code
- **WHEN** the Host & Meet header renders
- **THEN** Vibe Web SHOULD show the total count and client split when present.

#### Scenario: Stats missing

- **GIVEN** no aggregate stats event exists for the current plus code
- **WHEN** the Host & Meet header renders
- **THEN** Vibe Web MUST show a graceful empty or unavailable state.
