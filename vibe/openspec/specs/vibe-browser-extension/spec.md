# Vibe Browser Extension

## Purpose

Define current behavior for the standalone desktop browser extension that
provides a local Manifest V3 NIP-07 signer for Nostroots and compatible Nostr
web apps.

## Requirements

### Requirement: MV3 NIP-07 signer

The Nostroots Extension MUST provide a Manifest V3 NIP-07 signer for Nostroots
and compatible Nostr web apps on supported desktop browsers.

#### Scenario: Provider injection

- **GIVEN** a supported HTTPS page or local development origin loads
- **WHEN** the content script runs
- **THEN** it MUST inject a provider that lets compatible apps detect
  `window.nostr`.

#### Scenario: Exposed methods

- **GIVEN** a web app uses the extension provider
- **WHEN** it requests supported methods
- **THEN** the extension MUST expose `getPublicKey`, `signEvent`, `nip44`, and
  `nip04`.

### Requirement: Local key and approval model

The extension MUST store one local key/profile for v1 and gate non-trusted site
access through per-origin approvals.

#### Scenario: Key import and generation

- **GIVEN** the user sets up the extension
- **WHEN** they import `nsec`, private-key hex, a NIP-06 recovery phrase, or
  generate a new key
- **THEN** the extension MUST store one active key in extension local storage.

#### Scenario: Origin prompt

- **GIVEN** an origin outside the trusted Trustroots set requests access
- **WHEN** there is no remembered approval
- **THEN** the extension MUST offer allow-once, always-allow, or deny choices.

#### Scenario: Key replacement clears approvals

- **GIVEN** remembered site approvals exist
- **WHEN** the active key is replaced or removed
- **THEN** remembered approvals MUST be cleared.

### Requirement: Trustroots identity lookup

The extension MUST resolve Trustroots identity from Nostr profile sources used
by Vibe.

#### Scenario: Identity sources

- **GIVEN** a public key is checked for Trustroots linkage
- **WHEN** relay events are read
- **THEN** the extension SHOULD inspect kind `0`, kind `10390`, and kind
  `30390` profile/claim events where applicable.

#### Scenario: NIP-42 relay read

- **GIVEN** a Trustroots identity lookup reads from the NIP-42 relay
- **WHEN** an `AUTH` challenge is received
- **THEN** the extension SHOULD sign and send a kind `22242` auth event for the
  lookup key.

### Requirement: Packaging and reviewer behavior

The extension MUST produce browser-specific distributable packages from the same
source.

#### Scenario: Chrome package

- **GIVEN** the Chrome package command runs
- **WHEN** packaging completes
- **THEN** the output SHOULD be a Chrome Web Store ready zip under the extension
  packages directory.

#### Scenario: Firefox package

- **GIVEN** the Firefox package command runs
- **WHEN** packaging completes
- **THEN** the generated Firefox manifest MUST include the configured Gecko ID
  and reviewer source notes MUST describe how to reproduce the package.
