# Food Circle

## Purpose

Define the Food Circle web experience for finding, requesting, and sharing food
through location-aware records that remain compatible with Nostroots map notes.

## Requirements

### Requirement: Hub and standalone experience

The Nostroots hub MUST provide Food Circle as a "More experimental" card that
opens `/food/` as a standalone static web application.

#### Scenario: Opening Food Circle

- **GIVEN** a user is on the Nostroots web hub and has enabled "Show more
  experimental apps"
- **WHEN** they activate the Food Circle card
- **THEN** the browser MUST open `/food/`
- **AND** the app MUST offer immediate paths for finding food and sharing or
  reporting food.

### Requirement: Food places and temporary situations

Food Circle MUST distinguish ongoing places from time-limited offers and
requests, and MUST omit expired records from its active map and list.

#### Scenario: Browsing available food

- **GIVEN** the active dataset contains food pop-ups, community fridges,
  restaurants, dumpster spots, and food requests
- **WHEN** a user filters the map
- **THEN** the list and map MUST show only records matching the selected type
  and cost filters
- **AND** time-limited records whose expiration has passed MUST NOT appear.

#### Scenario: Adding a temporary situation

- **GIVEN** a user is sharing food or asking for food
- **WHEN** they submit a title, expiration, and valid location
- **THEN** Food Circle MUST create a locally visible record
- **AND** it MUST keep the user-facing offer or request distinct from permanent
  food places.

### Requirement: Plus Code-first locations

Every Food Circle record MUST use a canonical full Plus Code as its public
location and MAY also include an exact pin.

#### Scenario: Publishing an approximate location

- **GIVEN** a user chooses a map position and broad or neighborhood precision
- **WHEN** they leave exact-pin publishing disabled
- **THEN** Food Circle MUST derive the selected Plus Code from that position
- **AND** it MUST persist and render only the Plus Code area, not the source
  coordinates.

#### Scenario: Publishing an exact pin

- **GIVEN** a user explicitly enables exact-pin publishing
- **WHEN** the record is created
- **THEN** the app MUST verify that the pin lies inside the public Plus Code
- **AND** the Nostr representation MUST encode the pin as a standard `g`
  geohash tag while retaining the Plus Code labels.

### Requirement: Nostroots map-note compatibility

Food Circle records intended for network sharing MUST use kind `30397` event
templates and the established Nostroots Open Location Code, prefix, expiration,
and Trustroots-circle tag structure.

#### Scenario: Creating an interoperable food record

- **GIVEN** a valid Food Circle entry
- **WHEN** its Nostr event template is created
- **THEN** the template MUST include the public location as an
  `open-location-code` label and its derived `open-location-code-prefix` labels
- **AND** it MUST include `foodsharing` as a `trustroots-circle` label
- **AND** it MUST carry namespaced labels for food type, cost, and published
  Plus Code precision
- **AND** temporary records MUST use a NIP-40 `expiration` tag.

#### Scenario: Main Nostroots clients receive a Food Circle record

- **GIVEN** a signed Food Circle kind `30397` event is accepted and, where
  applicable, validated into kind `30398`
- **WHEN** Nostroots clients subscribe to their existing map-note streams
- **THEN** they MUST be able to render the record as a normal map note using
  its content and Plus Code even if they do not yet provide Food Circle-specific
  controls.

#### Scenario: Sharing with a browser signer

- **GIVEN** a user explicitly submits a Food Circle record and a compatible
  browser signer is available
- **WHEN** the signer approves the kind `30397` event
- **THEN** Food Circle SHOULD publish the signed event to its configured
  Nostroots relays
- **AND** a rejected signature or relay write MUST NOT remove the device-local
  record.

#### Scenario: Receiving Food Circle map notes

- **GIVEN** a configured relay returns a kind `30397` or `30398` map note with
  the `foodsharing` circle or topic label
- **WHEN** Food Circle can parse its Plus Code and optional food labels
- **THEN** it MUST merge the record into the active map and list without
  duplicating the same locally-created or mirrored record.

### Requirement: Local-first graceful operation

Food Circle MUST remain usable when a signer, relay, geolocation, or map tile
service is unavailable.

#### Scenario: Missing optional capabilities

- **GIVEN** one or more optional browser or network capabilities are unavailable
- **WHEN** the user opens or adds to Food Circle
- **THEN** existing list data and device-local entry creation MUST continue to
  work
- **AND** the UI MUST explain failed location or network actions without losing
  the submitted local entry.

### Requirement: Shared foodsharing circle chat

Food Circle MUST provide one shared Nostr conversation for the Trustroots
`foodsharing` circle rather than separate conversations for each food record.

#### Scenario: Reading the circle chat

- **GIVEN** a relay returns a kind `30397` event labeled `foodsharing` in the
  `trustroots-circle` namespace and without an Open Location Code
- **WHEN** Food Circle receives the event
- **THEN** it MUST render the event as a chat message rather than a map record
- **AND** reading MUST remain available without a signer.

#### Scenario: Posting to the circle chat

- **GIVEN** a compatible Nostr browser signer is available
- **WHEN** the user submits a non-empty chat message without private-key text
- **THEN** Food Circle MUST request a signature for a kind `30397` circle event
- **AND** it MUST publish the signed event to configured Nostroots relays
- **AND** it MUST label the event with `foodsharing` in the
  `trustroots-circle` namespace so Nostroots Web can show it in the same circle
  conversation.
