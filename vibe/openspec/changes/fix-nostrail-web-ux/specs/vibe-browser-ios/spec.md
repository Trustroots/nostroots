## ADDED Requirements

### Requirement: Foreground web geolocation

Nostroots iOS MUST allow HTTPS pages in its `WKWebView` to use the standard
`navigator.geolocation` permission flow while the app is in use, and MUST NOT
request always-on or background location access for this flow.

#### Scenario: Nostrail requests location after explanation

- **GIVEN** Nostrail is open in Nostroots iOS
- **AND** the page has not requested browser geolocation during initialization
- **WHEN** the user chooses “Use My Location” in Nostrail's soft prompt
- **THEN** WebKit and iOS MUST be able to present their standard location
  permission flow
- **AND** an approved foreground location result MUST be returned to the page's
  `navigator.geolocation` request.

#### Scenario: Location is declined

- **GIVEN** a loaded page requests foreground geolocation
- **WHEN** the user denies the WebKit or iOS location permission
- **THEN** the page MUST receive a geolocation failure
- **AND** the native browser and loaded page MUST remain usable.

#### Scenario: Foreground-only purpose

- **GIVEN** Nostroots iOS is installed
- **WHEN** iOS inspects the app's location usage declarations
- **THEN** the app MUST describe why location is used while the app is active
- **AND** it MUST NOT declare always-on or background location access for web
  geolocation.
