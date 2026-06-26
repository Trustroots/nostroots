# Vibe Browser iOS

## Purpose

Define current behavior for the native Nostroots Browser iOS shell, including
WKWebView loading, native-backed NIP-07, local key storage, permissions,
settings, and native push bridging.

## Requirements

### Requirement: Native browser shell

Nostroots Browser iOS MUST be a native SwiftUI app using `WKWebView` to load the
Nostroots web experience.

#### Scenario: Default web origin

- **GIVEN** the iOS browser app launches normally
- **WHEN** the web view is created
- **THEN** it MUST load `https://nos.trustroots.org/` by default.

#### Scenario: Native-backed NIP-07 provider

- **GIVEN** the loaded web app calls `window.nostr`
- **WHEN** the native bridge receives supported NIP-07 requests
- **THEN** the app MUST service them with the locally stored native key and
  native signing/encryption implementation.

### Requirement: Local key storage

The iOS browser app MUST store its own imported or generated key in this app's
private Keychain storage for v1.

#### Scenario: Separate keychain item

- **GIVEN** `nr-app` already has a key in its private keychain storage
- **WHEN** Nostroots Browser iOS starts
- **THEN** it MUST NOT assume it can read that private `nr-app` key.

#### Scenario: Future shared keychain

- **GIVEN** a future release shares keys with another app
- **WHEN** both apps need access to the same key
- **THEN** they MUST use a common Apple Developer Team, shared Keychain Access
  Group entitlement, and an explicit migration from any private item.

### Requirement: Permissions and settings

The iOS browser app MUST expose user-facing controls for native NIP-07
permissions, key status, and Vibe push notification state.

#### Scenario: Non-trusted origin NIP-07 access

- **GIVEN** a non-trusted origin requests NIP-07 key access
- **WHEN** the app has no remembered permission for that origin
- **THEN** the user MUST be prompted before the request is allowed.

#### Scenario: Settings review

- **GIVEN** an origin has used NIP-07 access
- **WHEN** the user opens settings
- **THEN** the app SHOULD let the user inspect and revoke remembered NIP-07
  permissions.

### Requirement: Native push bridge

The iOS browser app MUST bridge native APNs registration and notification taps
to the web/product context used by Vibe push notifications.

#### Scenario: Notification tap

- **GIVEN** a Vibe push notification includes a plus code
- **WHEN** the user taps the notification
- **THEN** the app SHOULD route the web/product context toward that plus-code
  area.
