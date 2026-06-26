# Vibe OpenSpec Project

## Purpose

`vibe/` contains the Nostroots web/browser stack that can move independently of
the main `nr-app`, `nr-common`, and `nr-notification-daemon` stack. This
OpenSpec workspace captures durable Vibe product and protocol behavior so
changes can be discussed against explicit capabilities instead of scattered
implementation notes.

## Scope

Baseline capabilities live in `specs/<capability>/spec.md` and describe current
tracked behavior. Future work lives in `changes/<change-id>/` with a
`proposal.md`, `tasks.md`, and spec deltas where the change affects a durable
capability.

The first-pass capability set covers:

- `vibe-nostr-events-and-relays`
- `vibe-web`
- `vibe-browser-ios`
- `vibe-browser-extension`
- `vibe-browser-expo-prototype`
- `vibe-nip42-relay`
- `trustroots-import-tool`
- `vibe-push-notifications`

## Source Inventory Rules

Use tracked source and docs as the inventory source. Prefer `git ls-files vibe`
when checking what belongs in a spec.

Exclude generated or local-only material from normative requirements:

- dependency folders such as `node_modules`
- native build output such as `.build`
- Go caches such as `.gocache` and `.gomodcache`
- local environment files and secrets
- test results, reports, and other run artifacts

Existing files under `vibe/docs/` remain narrative/background docs unless a
requirement here explicitly references their behavior.

## Spec Style

Requirements use RFC-style words (`MUST`, `SHOULD`, `MAY`) and include at least
one `#### Scenario:` block. Keep implementation file names in specs only when
they disambiguate an existing interface or trusted source of truth.

Backlog changes MUST avoid implying implementation has already happened. Use
`ADDED Requirements` for future behavior and keep task lists concrete enough for
an implementation pass.

## Validation

Run OpenSpec validation from this directory when the CLI is available:

```bash
openspec validate --strict
```

If the CLI is not available locally, check the Markdown structure manually and
verify new relative links from `vibe/README.md`, `vibe/docs/README.md`, and
`vibe/openspec/**`.
