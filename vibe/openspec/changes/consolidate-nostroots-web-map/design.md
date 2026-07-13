# Design: Consolidate Nostroots Web and Nostroots Map

## Context

The Vibe Web workspace currently exposes two browser surfaces for map notes:

| Surface | Role today | Technical depth |
| --- | --- | --- |
| `/web/` | Current Nostroots Web app: map, notes, chat, profiles, keys, settings, stats | Canonical and feature-complete |
| `/nostroots-map/` | Experimental map-first prototype | Standalone duplicate with a smaller feature set |

Both consume kinds `30397` and `30398`, index areas with Plus Codes, use
MapLibre with a Leaflet fallback, detect NIP-07, and support publishing notes.
The prototype therefore does not have a distinct product job.

## Goals

- Present one unambiguous Nostroots browser product.
- Preserve existing links to the experimental path.
- Remove duplicate protocol/runtime code rather than creating a shared layer
  solely to keep two equivalent applications alive.
- Avoid coupling the consolidation to a speculative map redesign.

## Non-goals

- UI parity work between the web and native clients.
- Refactoring the large `/web/` app into modules.
- Migrating user state from the prototype; it has no canonical account or
  settings state that should override `/web/`.

## Product boundary

The product hierarchy becomes:

```text
Nostroots
├── Nostroots for Android
├── Nostroots for iOS
└── Nostroots Web (/web/)
    ├── Map
    ├── Chat
    └── Profiles, keys, and settings
```

The hub continues to call the browser client **Nostroots Web**. It no longer
presents **Nostroots Map** as an experimental app.

## Compatibility redirect

Keep `vibe/web/nostroots-map/index.html`, but replace it with a small static
compatibility page:

- JavaScript uses `location.replace()` so the retired URL does not create an
  extra Back-button history entry.
- The target is `../web/#map`.
- Existing query parameters are preserved before setting the canonical map
  hash, allowing deployment or client-context parameters to survive.
- A meta refresh and ordinary link provide no-JavaScript and accessibility
  fallbacks.
- The page declares the canonical `/web/#map` destination and explains the
  move briefly if redirecting is delayed.

The old `nostroots-map/index.js` runtime is deleted. Git history is the archive
for any future UX research; the deployed site should not ship dormant duplicate
application code.

## Hub changes

Remove the Nostroots Map card and any card-specific CSS from the root hub.
Keep the experimental toggle and all unrelated experiments unchanged. The
Nostroots Web card continues to link to `web/` and should describe traveler
notes by area plus posting with a Trustroots identity.

Do not rename `/web/`, the card, or the mobile applications in this change.

## Documentation and specification

- Remove Nostroots Map from the README's active experience and feature lists.
- Change privacy-policy scope from naming Nostroots Map explicitly to covering
  the compatibility route as part of the Nostroots web pages, if necessary.
- Modify the Vibe Web baseline requirements so the hub no longer enumerates
  Nostroots Map and the old route is specified as a redirect rather than an
  initializing prototype.

## Testing

Focused browser coverage should prove:

1. The experimental toggle does not reveal a Nostroots Map card.
2. `/nostroots-map/` lands at `/web/#map`.
3. Query parameters survive the compatibility redirect.
4. The normal Nostroots Web card and unrelated experiments remain unchanged.
5. The existing `/web/` map smoke test continues to pass.

Remove or rewrite tests that assert the old prototype shell, signer status,
layer selector, or standalone title.

## Rollout and rollback

This is a static deployment with no data migration. Rollout consists of
deploying the hub, redirect page, docs, and tests together. Rollback restores
the deleted prototype files and hub card from Git.

## Risks

- **Stale deep links:** mitigated by retaining the redirect path.
- **Accidental loss of a useful prototype idea:** mitigated by Git history and
  by keeping UX redesign out of this change.
- **Incomplete cleanup:** mitigate with a repository-wide search for
  `nostroots-map`, `Nostroots Map`, and the retired hub card class.
- **Unrelated working-tree changes:** the current Trustroots hub icon edit must
  be preserved and excluded from this change unless the owner explicitly
  includes it.
