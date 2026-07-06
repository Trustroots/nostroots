# Add Circle App Generator

## Summary

Add a circle mode to the existing Vibe Web app and generate stable static URLs
for individual Trustroots circles, reusing the same `/web/` codebase.

## Motivation

Dedicated circle URLs make Trustroots communities easier to share while avoiding
copies of the large app for every circle.

## Impact

- Adds a circle config source of truth for slugs and display titles.
- Adds `?circle=<slug>` behavior to `/web/`.
- Adds generated static redirect/list pages under a circles directory.
- Adds focused tests and README guidance for regeneration.
