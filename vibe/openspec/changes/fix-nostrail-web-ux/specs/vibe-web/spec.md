## ADDED Requirements

### Requirement: Nostrail shared app chrome and identity presentation

The Nostrail web experiment MUST use the shared Nostroots app-header pattern and MUST NOT present hexadecimal public keys in visible or accessibility-facing interface text.

#### Scenario: Linked Trustroots identity in the header

- **GIVEN** a full signer whose public key resolves to a Trustroots/NIP-05 identity
- **WHEN** Nostrail renders its header
- **THEN** it MUST present the friendly identity using the shared app-header pattern
- **AND** it MUST NOT present the signer's hexadecimal public key.

#### Scenario: Signer without a friendly identity

- **GIVEN** a full signer whose key has no resolved friendly identity
- **WHEN** Nostrail renders signer state
- **THEN** it MUST show a plain connected-signer state or a shortened `npub`
- **AND** it MUST NOT fall back to a full or shortened hexadecimal public key.

#### Scenario: Recipient and peer identity fallback

- **GIVEN** a selected recipient or received-location author has no resolved friendly identity
- **WHEN** Nostrail renders that person
- **THEN** it MUST use the entered label, a generic role label, or a shortened `npub`
- **AND** no visible text, tooltip, or accessibility label may contain the hexadecimal key.

### Requirement: Nostrail interactive approximate-location map

Nostrail MUST provide a map that supports user-controlled movement and zoom and MUST render shared approximate areas from their geographic coordinates.

#### Scenario: Move and zoom the map

- **GIVEN** the Nostrail map has initialized
- **WHEN** a user drags, swipes, scrolls, pinches, uses the keyboard, or activates a zoom control
- **THEN** the map viewport MUST move or zoom accordingly
- **AND** ordinary state renders MUST NOT reset the user-selected viewport.

#### Scenario: Render own approximate area

- **GIVEN** Nostrail has an accepted approximate location containing center coordinates and accuracy
- **WHEN** the map renders the current user area
- **THEN** it MUST place the area at those coordinates
- **AND** it MUST visually communicate approximation rather than implying an exact point.

#### Scenario: Render received approximate area

- **GIVEN** Nostrail receives a valid, unexpired encrypted peer location with center coordinates and accuracy
- **WHEN** the event is rendered
- **THEN** the map MUST place the peer area at the payload coordinates
- **AND** it MUST remove the area when the share stops or expires.

#### Scenario: Map assets unavailable

- **GIVEN** map tiles or the map library fail to load
- **WHEN** Nostrail initializes
- **THEN** recipient selection and encrypted sharing controls MUST remain usable
- **AND** Nostrail MUST show a non-blocking map-unavailable state.

### Requirement: Nostrail consent-based location request

Nostrail MUST explain its use of approximate location before invoking the browser permission prompt during initial use.

#### Scenario: Initial soft request

- **GIVEN** a user opens Nostrail without a current location fix
- **WHEN** the initial interface renders
- **THEN** it MUST explain that approximate location can center the map and support sharing
- **AND** it MUST offer actions equivalent to “Use My Location” and “Not Now”
- **AND** it MUST NOT invoke browser geolocation before the affirmative action.

#### Scenario: Accept the soft request

- **GIVEN** the soft location request is visible
- **WHEN** the user chooses “Use My Location” and browser geolocation succeeds
- **THEN** Nostrail MUST compute the existing approximate area
- **AND** it MUST center the map on that area without preventing later manual movement.

#### Scenario: Decline or deny location

- **GIVEN** the user dismisses the soft request or browser permission is denied, unavailable, or times out
- **WHEN** Nostrail returns to its normal interface
- **THEN** the map MUST remain movable and zoomable
- **AND** recipient selection MUST remain usable
- **AND** Nostrail MUST provide a clear later retry path before location-dependent sharing.

#### Scenario: Sharing actions require a location fix

- **GIVEN** one or more recipients have resolved successfully
- **AND** Nostrail has no accepted approximate location
- **WHEN** the sharing controls render
- **THEN** invite and start-sharing actions MUST remain disabled
- **AND** they MUST become available only after “Use My Location” succeeds.

### Requirement: Nostrail reliable recipient addition

Nostrail MUST reliably add recipients through the existing input for Trustroots usernames, Trustroots profile URLs, NIP-05 handles, npubs, and hexadecimal public keys while distinguishing pending, successful, duplicate, and failed resolution states.

#### Scenario: Resolve and add a Trustroots username

- **GIVEN** a user enters a Trustroots username whose NIP-05 record contains a valid public key
- **WHEN** the user submits the recipient form
- **THEN** Nostrail MUST show that resolution is in progress
- **AND** it MUST add exactly one resolved recipient row with a friendly non-hex label
- **AND** the friendly Trustroots label MUST link to that member's Trustroots profile
- **AND** sharing actions MUST count that row as selected.

#### Scenario: Add an npub or hexadecimal public-key input

- **GIVEN** a user enters a valid npub or 64-character hexadecimal public key
- **WHEN** the user submits the recipient form
- **THEN** Nostrail MUST canonicalize and add the recipient
- **AND** it MUST display a friendly identity when resolvable or a shortened `npub` otherwise
- **AND** it MUST NOT display the hexadecimal input after submission.

#### Scenario: Duplicate aliases resolve to one person

- **GIVEN** multiple submitted values resolve to the same canonical public key
- **WHEN** recipient resolution finishes
- **THEN** Nostrail MUST retain exactly one selected recipient
- **AND** it MUST explain that the duplicate was already selected without treating it as a successful new addition.

#### Scenario: Recipient lookup fails

- **GIVEN** a submitted value is invalid, times out, returns an HTTP error, or returns no valid Nostr key
- **WHEN** recipient resolution finishes
- **THEN** Nostrail MUST show an actionable reason for that value
- **AND** it MUST retain the failed value for edit or retry
- **AND** the failed value MUST NOT enable sharing actions.

#### Scenario: Mixed recipient batch

- **GIVEN** one submission contains successful, duplicate, and failed recipient values
- **WHEN** all resolutions finish
- **THEN** Nostrail MUST keep each successful unique recipient selected
- **AND** it MUST preserve each failed value for correction
- **AND** it MUST summarize the partial result without hiding row-level outcomes.

### Requirement: Nostrail unobstructed map guidance

Nostrail MUST keep instructional, permission, sharing, and error copy in its control surfaces rather than overlaying the interactive map canvas.

#### Scenario: Initial map rendering

- **GIVEN** Nostrail has no current location fix
- **WHEN** the map renders
- **THEN** it MUST NOT display “Choose people, then share your approximate area.” over the map
- **AND** any next-step guidance MUST appear in the control panel or recipient sheet without obstructing map gestures or zoom controls.
