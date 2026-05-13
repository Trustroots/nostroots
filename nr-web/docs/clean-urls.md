# Clean URLs on GitHub Pages

`nr-web` currently uses hash routes, for example:

- `/#stats`
- `/#profile/npub1...`
- `/#9C3XGV75+`

This works well on GitHub Pages because the browser keeps the hash fragment on
the client. GitHub Pages only needs to serve `index.html`; the app reads
`location.hash` and decides which screen to show.

## Can GitHub Pages remove the `#`?

Not cleanly by itself. GitHub Pages serves static files and supports a custom
`404.html`, but it does not provide true single-page-app rewrite rules such as:

```text
/stats -> /index.html
/profile/npub1... -> /index.html
```

Without those rewrites, a direct visit to `/stats` asks GitHub Pages for a real
`stats` file or directory. If none exists, Pages returns the custom `404.html`
if one is present.

## Possible workaround

A `404.html` shim could read `location.pathname`, convert it to the equivalent
hash route, and load or redirect into the app. For example, `/stats` could become
`/#stats` in the browser.

That can make path-style links appear to work for people, but direct visits
still receive an HTTP `404` response from GitHub Pages. That is not functionally
the same as a real clean URL, especially for crawlers, previews, monitoring, and
anything that checks HTTP status codes.

## Better option for real clean URLs

Use a host or layer with rewrite support, such as Cloudflare Pages, a Cloudflare
Worker, or another static host that can route all app paths to `index.html` with
HTTP `200`.

Until clean URLs are worth adding rewrite-capable hosting, the safest option is
to keep the current hash routes on GitHub Pages.
