# Consolidate Nostroots Web and Nostroots Map

## Summary

Make `/web/` the single canonical Nostroots browser application, remove the
separate Nostroots Map product entry from the root hub, and retain
`/nostroots-map/` only as a compatibility redirect to the map in Nostroots Web.

The browser product keeps the name **Nostroots Web**. Nostroots remains the
overall product name across the Android, iOS, and web clients; Map, Chat, and
Profiles are features inside those clients rather than separate products.

## Motivation

Nostroots Web and the experimental Nostroots Map currently serve the same core
user journey: browse Plus Code areas, read kind `30397`/`30398` traveler notes,
connect a NIP-07 signer, and publish a map note. They also independently
implement much of the same map, relay, signer, expiry, and note-rendering logic.

The experimental map is a thinner prototype. It lacks the canonical web app's
authenticated relay behavior, configurable relays, identity and profile
resolution, caching, deduplication, routing, chat, and other mature behavior.
Keeping both surfaces visible suggests two products, creates inconsistent
capabilities, and requires two implementations of the same protocol flow.

## Decisions

- Keep **Nostroots Web** as the browser-client name and `/web/` as its stable
  URL.
- Treat Map as the primary/default view inside Nostroots Web.
- Remove Nostroots Map from the hub's experimental application list.
- Replace `/nostroots-map/` with a static compatibility redirect to
  `/web/#map` and remove the prototype runtime.
- Do not port the prototype implementation into `/web/`. Its history remains
  available in Git if a later, separately specified map-UX change wants to
  reuse an interaction idea.

## Scope

- Root hub card visibility and copy/tests that enumerate experimental apps.
- `/nostroots-map/` compatibility redirect and removal of its duplicate JS.
- Vibe Web README, privacy scope, and OpenSpec baseline behavior.
- Focused tests for the redirect and absence of the retired hub card.

## Non-goals

- Redesigning the current `/web/` map.
- Changing Nostr event kinds, Plus Code semantics, relay behavior, keys, or
  Trustroots identity rules.
- Renaming or changing the Android and iOS Nostroots apps.
- Changing other experimental experiences such as Nostrail, Wikistr,
  Squatbridge, or Radiostr.

## Impact

- Users see one browser application instead of two overlapping map products.
- Existing `/nostroots-map/` links continue to work through a redirect.
- `/web/` remains the only maintained browser implementation of Nostroots map
  notes.
- The main implementation risk is stale documentation or tests that still
  enumerate Nostroots Map as an active experiment.
