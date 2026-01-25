# Nostroots Web

A web-based version of the Nostroots application that provides map-based interaction with the nostr network. This is a single-page application that allows users to view and interact with location-based notes and events on a map interface.

## Features

- Interactive map using MapLibre GL
- Location-based note viewing and posting
- Responsive design for mobile and desktop
- Direct integration with nostr relays

## Usage

Simply open `index.html` in a web browser. The application is self-contained and can be served from any static file server.

For local development, you can use any simple HTTP server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

## Deployment

This application is deployed to GitHub Pages.


## Technical Details

The application is built as a single HTML file with embedded CSS and JavaScript. It uses:
- MapLibre GL for map rendering
- Nostr protocol for decentralized data storage
- CSS custom properties for theming

## Development

When committing changes to this directory, you may need to skip pre-commit hooks if linting fails (e.g., `git commit --no-verify`), as the linting configuration may not apply to this standalone HTML file.