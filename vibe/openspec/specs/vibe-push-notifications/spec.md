# Vibe Push Notifications

## Purpose

Define current behavior for the Vibe-only APNs push notification daemon,
including encrypted subscriptions, plus-code matching, RabbitMQ intake, and
APNs delivery.

## Requirements

### Requirement: Vibe-only APNs daemon

The Vibe push notification daemon MUST remain isolated from
`nr-notification-daemon` and deliver APNs notifications for Nostroots Browser.

#### Scenario: Required configuration

- **GIVEN** the daemon starts
- **WHEN** required values such as `PRIVATEKEY`, `STRFRY_URL`, `AMQP_URL`, APNs
  team/key/topic/private-key data, or APNs environment are missing
- **THEN** startup MUST fail with configuration feedback.

#### Scenario: APNs environment routing

- **GIVEN** a stored APNs token has a topic and environment
- **WHEN** a matching map-note event is processed
- **THEN** the daemon MUST send only to tokens matching the configured APNs
  topic and sandbox/production environment.

### Requirement: Encrypted subscription events

The daemon MUST read Vibe notification subscription events and store filters by
pubkey.

#### Scenario: Relay bootstrap

- **GIVEN** the daemon connects to the configured relay
- **WHEN** it subscribes to kind `10396`
- **THEN** it MUST load valid encrypted subscription events into the
  subscription store.

#### Scenario: Subscription update stream

- **GIVEN** RabbitMQ delivers a kind `10396` event
- **WHEN** the daemon decrypts and validates the payload
- **THEN** it MUST update the stored APNs tokens and plus-code filters for that
  pubkey.

### Requirement: Map-note matching

The daemon MUST match incoming map-note events against stored plus-code filters
before sending APNs notifications.

#### Scenario: Matching plus code

- **GIVEN** an incoming event contains a plus-code tag matching a stored filter
- **WHEN** the filter belongs to a valid subscription
- **THEN** the daemon SHOULD send an APNs notification for that subscriber.

#### Scenario: Ping acknowledgement

- **GIVEN** RabbitMQ delivers a daemon ping event
- **WHEN** the event matches the supported ping kind
- **THEN** the daemon SHOULD publish a signed acknowledgement event to the relay.
