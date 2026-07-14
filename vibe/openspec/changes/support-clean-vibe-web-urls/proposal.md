# Support Clean Vibe Web URLs

## Summary

Add clean path-style URLs for Vibe Web only when hosting can rewrite app paths to
the static app with HTTP 200 responses.

## Motivation

Hash routes work reliably on GitHub Pages, but clean URLs are friendlier for
sharing, previews, and monitoring when a host supports rewrites.

## Impact

- Keeps current hash routes as the safe GitHub Pages-compatible baseline.
- Defines clean URL support as a hosting/routing capability, not only a client
  router change.
- Avoids relying on a `404.html` shim as the real solution.
