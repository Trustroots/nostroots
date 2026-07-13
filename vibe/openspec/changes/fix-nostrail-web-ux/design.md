## Context

Nostrail is a static Vibe Web experiment at `vibe/web/nostrail/` in the sibling Nostroots repository. Its current header is bespoke, its signer pill renders a shortened hexadecimal key, and its “map” is a CSS background with markers positioned by a pubkey hash rather than geographic coordinates. Recipient parsing and mocked browser coverage exist, but the asynchronous add flow clears input immediately, provides no pending state, collapses lookup failures into generic copy, and proves success only against mocked NIP-05 responses.

The implementation must remain a foreground-only encrypted location-sharing experiment. It must preserve the current NIP-07/NIP-44 event and relay behavior, avoid new control-plane configuration, and follow the Vibe Web preference for small static modules and focused regression coverage.

## Goals / Non-Goals

**Goals:**

- Make Nostrail visually consistent with the other Nostroots web surfaces.
- Keep hexadecimal public keys internal while retaining all currently accepted recipient input formats.
- Provide a genuinely interactive, coordinate-aware approximate-location map.
- Ask for location in context, after an explanatory user action, without blocking browsing or recipient selection.
- Make recipient resolution progress, success, duplicate handling, and failure correction obvious and testable.

**Non-Goals:**

- Native iOS Nostrail changes, background location updates, or changes to the event format.
- A searchable Trustroots contact directory or social-graph picker.
- New relays, server APIs, environment variables, Caddy routes, Compose services, or MediaWiki settings.
- Exact-location sharing or increased location precision.

## Decisions

### Reuse shared header chrome while keeping one signer authority

Nostrail will use the shared `site-chrome.css` header structure, logo, Android/iOS links, responsive behavior, and identity-pill presentation. The page may reuse or minimally expose the existing shared identity resolver, but Nostrail's current signer capability state remains authoritative for enabling encrypted actions. The header shows a linked Trustroots/NIP-05 identity when available and a plain signer state otherwise; it never falls back to hexadecimal key text.

This is preferred over restyling the bespoke top bar because it prevents another near-copy of shared app chrome. It is preferred over running two unrelated signer-state machines because duplicate state can disagree during delayed extension startup.

### Treat hexadecimal keys as accepted input, not presentation

The internal 64-character key remains the canonical recipient and relay identifier. Visible identity uses, in order, a resolved Trustroots/NIP-05 label, the label originally entered by the user, or a shortened NIP-19 `npub`. Signer and received-location states use friendly identity or generic role labels when no profile label is available. No visible row, pill, status, tooltip, or accessibility label contains hexadecimal key material.

This preserves interoperability for advanced input without exposing implementation-oriented identifiers in the normal interface.

### Use the existing Leaflet map pattern

Nostrail will reuse the Leaflet/OpenStreetMap setup already present in `vibe/web/nostroots-map/`, including mouse/touch panning, pinch/wheel zoom, keyboard support, and visible zoom controls. This is sufficient for the feature and avoids introducing another map dependency or the heavier MapLibre worker path solely for Nostrail.

Own and peer locations render from `centerLat`/`centerLon`. Approximate locations use a circle or equivalent area indicator based on `accuracyM`, not a precise-looking point alone. The map centers on an accepted initial location request or an explicit recenter action, but incoming events and normal renders do not override a viewport the user has moved.

### Use a soft prompt before browser geolocation

On first load, the page displays a compact explanation with “Use My Location” and “Not Now.” Nostrail calls `navigator.geolocation.getCurrentPosition` only after “Use My Location.” Invite and start-sharing actions remain disabled until that request succeeds. Declining the soft prompt or browser permission leaves the map movable and the recipient sheet usable. A retry action remains available after denial or timeout.

This is preferred over permission on page load because browser prompts without context are easy to reject and make the map appear blocked.

### Make recipient addition an explicit asynchronous state machine

Submitting recipient input creates pending rows or a pending form state, disables duplicate submission, and awaits resolution before reporting success. Successful recipients are canonicalized by resolved pubkey, labeled without hex, and added once. Invalid input, HTTP failure, timeout, malformed NIP-05 data, and missing Trustroots key produce distinct actionable feedback while keeping the failed value available for editing or retry.

The existing normalization formats remain unchanged. No searchable people picker is added. Sharing and invite actions count only successfully resolved recipient rows and require an accepted approximate location. Friendly Trustroots recipient labels link directly to the corresponding Trustroots profile.

### Keep map guidance out of the map canvas

The “Choose people, then share your approximate area.” overlay and its render-time replacement are removed. Location consent, lookup progress, sharing state, and errors live in the existing control panel or recipient sheet so the map remains unobstructed and its controls remain usable.

## Risks / Trade-offs

- **[External map assets fail or are blocked]** → Keep controls and recipient sharing usable, show a non-blocking map-unavailable state, and do not make map tile success a prerequisite for encryption or publishing.
- **[Shared chrome identity code duplicates signer work]** → Establish one signer capability state and reuse only shared identity presentation/lookup pieces needed by the header.
- **[NIP-05 lookups are slow or unreliable]** → Add a bounded timeout, pending state, retry/edit actions, and per-input feedback; do not clear unresolved input.
- **[Map updates unexpectedly recenter while the user browses]** → Track whether the user has moved the viewport and recenter only on explicit actions or the first accepted location.
- **[Raw hex input has no friendly profile]** → Encode and display a shortened `npub`; retain the hex value only internally.
- **[Map libraries complicate DOM unit tests]** → Keep map initialization behind a small adapter and cover map interaction in Playwright; stub the adapter in helper tests.

## Migration Plan

1. Copy this change directory to `nostroots/vibe/openspec/changes/fix-nostrail-web-ux/` and run OpenSpec validation from `nostroots/vibe/`.
2. Implement shared header and identity presentation without changing signer/event behavior.
3. Add the Leaflet adapter and replace decorative markers with coordinate-aware layers.
4. Add the soft location prompt and explicit viewport/recenter behavior.
5. Harden recipient addition and remove all hexadecimal presentation paths.
6. Run focused unit and Chromium E2E tests, then the Vibe Web fast test target if appropriate.
7. Smoke-test narrow and desktop viewports with location accepted, declined, and unavailable.
8. Deploy the static web change and verify read-only behavior on `/nostrail/`.

Rollback is a revert of the Nostrail web, tests, and Vibe OpenSpec commits. No data or infrastructure migration is involved.

## Open Questions

None. Product choices are settled: keep the existing input rather than add a people picker, show no hexadecimal public keys, and use a soft prompt before browser location permission.
