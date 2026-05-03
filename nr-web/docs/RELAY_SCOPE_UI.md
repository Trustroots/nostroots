# Relay scope UI (map notes and chat)

This document explains how **public vs auth-required relay** scope is represented in `nr-web`, why **🌍 / 🔐** pills often disappear for events you only **receive** from relays, and what to consider if we change behavior later.

## Concepts

### `relayScope` is client metadata, not Nostr

Nostr `EVENT` objects from relays do **not** include a `relayScope` field. The web app attaches it only on paths where we know **which relay URLs** were involved (typically **after a successful publish**).

Allowed values used in UI today:

| Value     | Meaning in UI                                      |
|-----------|-----------------------------------------------------|
| `public`  | At least one **known public** relay URL was used.  |
| `auth`    | Non-empty relay set with **no** known public URL (e.g. NIP-42 / restricted relays only). |
| *(absent)* | **Unknown** — we must not assume `public`.        |

Classification is implemented by `getRelayScopeFromRelayUrls(urls)` in:

- `index.html` (map / note compose)
- `chat-app.js` (chat publish and display helpers)

It returns `'public'` if any URL matches `isKnownPublicRelayUrl`, else `'auth'` if the list is non-empty, else `''` (empty / unknown).

Known public relays are currently the Trustroots and NomadWiki defaults (see `isKnownPublicRelayUrl` in those files). Custom relay settings can override via `relaySettings.isPublicRelayUrl` where wired.

## Why we stopped defaulting unknown to “public”

Content that only reached **auth-required** (NIP-42) relays was incorrectly shown with a **public globe** when the client guessed scope without evidence. Display logic was tightened so **no metadata ⇒ no globe/auth pill** for relay scope (see `getRelayScopeForDisplay` in `chat-app.js`).

That is **correct for privacy** but means most **subscription-only** events never get a pill.

## Map notes (`index.html`)

### Where the pill is drawn

`createNoteItem` appends `.note-relay-scope-pill` (🌍 or 🔐) only when `event.relayScope === 'public' || event.relayScope === 'auth'`.

### Where `relayScope` is set

- **Local publish:** After publishing a map note, `signedEvent.relayScope` is set from **`getRelayScopeFromRelayUrls(successful.map(r => r.url))`** (successful publish acks only), then `processIncomingEvent(signedEvent)` stores it.
- **Incoming from subscription:** `processIncomingEvent` copies `relayScope` onto stored events **only** if the incoming object already has `'public'` or `'auth'`. Plain relay events therefore stay without `relayScope`.
- **Replaceable updates:** When a newer version arrives without scope, the replace path can **preserve** a previously stored `relayScope` if it was valid (`incoming || preserved`).

### Cached notes

Old localStorage/cache entries may still carry `relayScope` from an earlier session; new subscription-fed notes generally will not until we implement a richer source signal (below).

## Chat (`chat-app.js`)

### Channel messages

Thread rows add `.message-relay-pill` only when `getRelayScopeForDisplay(ev, conv)` returns `'public'` or `'auth'`, which today means **`ev.relayScope` is already set** on that event object.

Outgoing channel messages set `relayScope` from publish results where that path uses per-relay success lists; incoming events without metadata show **no** relay-scope pill (by design).

### Conversation list icons (🌐 / 🔒 / `#`)

Sidebar **encryption / channel type** icons (`getConversationListEncIcon`) are separate from relay-scope pills: they indicate **DM/group vs channel**, not whether the last message hit public vs auth relays.

## Future work (if we want icons for received events)

Any enhancement should avoid **false “public”** labels. Possible directions:

1. **Relay of origin:** When handling `EVENT` from a specific WebSocket/subscription, record the **relay URL that delivered** the message and derive display scope with `getRelayScopeFromRelayUrls([thatUrl])` (or store `seenFromRelayUrls`). Requires threading relay URL from the subscription layer into `processIncomingEvent` (or equivalent).
2. **Explicit “unknown” affordance:** A third neutral icon or “scope unknown” tooltip — only if product/copy agrees it adds value without implying public.
3. **Do not** resurrect “default to public” for unknowns; that reintroduces the misleading globe for NIP-42-only paths.

## Quick file reference

| Area              | Location |
|-------------------|----------|
| Scope from URLs   | `getRelayScopeFromRelayUrls`, `isKnownPublicRelayUrl` in `index.html` and `chat-app.js` |
| Map ingest        | `processIncomingEvent` in `index.html` |
| Map note pill     | `createNoteItem` in `index.html` |
| Map publish scope | `publishNoteFromModal` / successful relay list in `index.html` |
| Chat display gate | `getRelayScopeForDisplay`, thread render using `message-relay-pill` in `chat-app.js` |
| Chat publish scope| Channel send path setting `relayScope` from `succeeded` URLs in `chat-app.js` |

When changing this behavior, add or adjust **unit/integration tests** under `nr-web/tests/` so scope display and publish metadata stay aligned with product expectations.
