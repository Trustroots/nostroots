# Vibe Browser Expo Prototype

## Purpose

Define the preserved Expo browser prototype's role, boundaries, and expected
browser/key/NIP-07 behavior relative to the production native iOS browser.

## Requirements

### Requirement: Preserved standalone prototype

The Expo browser app MUST remain a standalone prototype separate from the root
pnpm workspace and from the production native iOS browser app.

#### Scenario: Local development

- **GIVEN** a developer works on the Expo prototype
- **WHEN** they install, run, test, or lint it
- **THEN** those commands MUST be run from `vibe/browser/expo`.

#### Scenario: Production iOS source of truth

- **GIVEN** behavior differs between the Expo prototype and native SwiftUI iOS
  browser
- **WHEN** the behavior is iOS-specific production behavior
- **THEN** `vibe/browser/ios` MUST be treated as the source of truth.

### Requirement: Prototype browser behavior

The Expo prototype MUST match the browser/key/NIP-07 shape used by Nostroots
Browser while keeping native push and EAS build profiles out of v1 scope.

#### Scenario: Web experience loading

- **GIVEN** the Expo prototype launches
- **WHEN** the browser screen renders
- **THEN** it SHOULD load `https://nos.trustroots.org/`.

#### Scenario: Expo key and permission storage

- **GIVEN** the Expo prototype handles a local key or NIP-07 permission
- **WHEN** it persists local state
- **THEN** it SHOULD use Expo-appropriate storage such as SecureStore or local
  preferences rather than the native iOS browser Keychain item.

#### Scenario: Notification stub

- **GIVEN** web code calls the prototype notification bridge
- **WHEN** v1 behavior is active
- **THEN** the prototype MAY expose a stub and MUST NOT claim full native push
  notification support.
