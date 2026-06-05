# Vibe Push Notification Daemon

This daemon is isolated from `nr-notification-daemon`. It listens for Vibe-only
encrypted kind `10396` subscription events, stores APNs tokens and plus-code
filters by pubkey, matches incoming map-note events, and sends APNs payloads to
Nostroots Browser.

## Configuration

Required:

- `PRIVATEKEY` - daemon Nostr private key as hex or `nsec`.
- `STRFRY_URL` - relay URL to load kind `10396` subscriptions from.
- `AMQP_URL` - RabbitMQ URL for incoming relay/event messages.
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY` - APNs `.p8` key contents.
- `APNS_TOPIC` - usually `org.trustroots.nostroots.browser`.
- `APNS_ENV` - `sandbox` or `production`.

Optional:

- `RABBITMQ_QUEUE` - defaults to `vibe-push-notification-daemon`.

## Commands

```bash
deno task run
deno task test
```
