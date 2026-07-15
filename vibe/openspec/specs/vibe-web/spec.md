# Vibe Web

## Purpose

Define current behavior for the standalone Vibe Web static workspace, including
the root hub, `/web/` Nostroots Web app, routing, relay/key behavior,
experiments, examples, and testing expectations.

## Requirements

### Requirement: Static web app structure

Vibe Web MUST remain a static web workspace that can be served without a build
step for the main pages.

#### Scenario: Root hub

- **GIVEN** a user opens the Vibe Web root page in a normal browser
- **WHEN** the page renders and the client is not detected as an in-app WebView
- **THEN** it MUST act as a hub for Nostroots Web, background information,
  classic Trustroots network settings, mobile app downloads, and optional
  experimental experiences.

#### Scenario: Concise hub titles

- **GIVEN** a user opens the root hub or background page
- **WHEN** its main heading renders
- **THEN** the root hub heading MUST be "Nostroots" and the background heading
  MUST be "Background".

#### Scenario: Concise shared footer

- **GIVEN** a user views the hub or background-page footer
- **THEN** the Trustroots link label MUST omit the `.org` suffix
- **AND** deployment metadata MUST show only its UTC date and time, followed by
  the GitHub icon without a commit hash.
- **AND** on narrow/mobile viewports, the footer MUST sit at the bottom of the
  dynamic visible viewport, above any safe-area inset.

#### Scenario: Current Nostroots Web app

- **GIVEN** a user opens `/web/`
- **WHEN** the browser loads the app
- **THEN** the experience MUST provide the current map, chat, profile, keys,
  settings, stats, relay, and Trustroots-style activity flows.

#### Scenario: Previous Nostroots Web app path

- **GIVEN** a user opens an old `/v0/` Nostroots Web link
- **WHEN** the compatibility page loads
- **THEN** it MUST redirect to the matching `/web/` URL while preserving query
  parameters and hash routes.

### Requirement: Single canonical browser map surface

Vibe Web MUST provide `/web/` as the only maintained Nostroots browser
application for map-note behavior.

#### Scenario: Canonical browser map

- **GIVEN** a user wants to browse or publish Nostroots map notes in a browser
- **WHEN** they choose Nostroots Web from the root hub
- **THEN** the hub MUST open `/web/`
- **AND** Map MUST remain the primary/default view within that application.

#### Scenario: Retired map URL compatibility

- **GIVEN** a user follows an existing `/nostroots-map/` URL
- **WHEN** the compatibility page loads
- **THEN** it MUST replace the current browser history entry with `/web/#map`
- **AND** it MUST preserve existing query parameters
- **AND** it MUST provide a no-JavaScript redirect or link fallback.

#### Scenario: One hub product entry

- **GIVEN** a user views the root hub with experimental applications revealed
- **WHEN** the experience cards render
- **THEN** Nostroots Web MUST be the only Nostroots browser map product shown
- **AND** a separate Nostroots Map card MUST NOT be shown.

### Requirement: Hub visibility by client context

The root hub at `nos.trustroots.org/` MUST adapt install prompts and related
copy based on whether the page runs inside a Nostroots native WebView shell.

The page MUST treat the client as in-app when any of these is true:

- `navigator.userAgent` contains the marker `NostrootsBrowser/`
- `window.nostr.__nostrootsBrowser === true` (injected NIP-07 bridge)
- `window.__nostrootsNip7Installed === true` (injected before content load)

Shells that set this marker include `nr-app` BrowserScreen and native iOS
`WKWebView`.

#### Scenario: Hub card tiers in a regular browser

- **GIVEN** a user opens the hub in a normal mobile or desktop browser
- **WHEN** the page renders and the client is not detected as in-app
- **THEN** the hub MUST show Trustroots.org, Nostroots Web, and Squatbridge
  (`examples/squatbridge/`) as default web experiences
- **AND** it MUST show the "Get the app" download section (`#download-section`)
  with Android and iOS store links, top-nav Android and iOS store links, hub lead
  copy that mentions getting the mobile app, and the NIP-7 info modal bullet
  recommending mobile app install
- **AND** additional experimental experiences (Nostrail, Radiostr, and the external
  Trustroots Wiki, Nomadwiki, Trashwiki, Hitchwiki, and Hitchwiki Maps cards,
  and third-party links such as Treasures and Miti) MUST remain hidden
  until the user enables "Show more experimental apps"
- **AND** the five external wiki cards MUST use the logos supplied by their
  corresponding sites and open those original sites in the current tab
- **AND** Wikistr MUST NOT have a root-hub card, while its direct
  `examples/wikistr/` route remains available
- **AND** on desktop, the browser-extensions section MUST be visible until a
  NIP-07 signer is detected; on mobile viewports it MAY stay hidden by layout
  rules

#### Scenario: In-app WebView visit

- **GIVEN** a user opens the hub inside a Nostroots app WebView that identifies
  itself as in-app
- **WHEN** the page renders
- **THEN** the hub MUST still show Trustroots.org, Nostroots Web, Squatbridge,
  and other default web experiences; additional experimental cards and external
  third-party links still follow the user's toggle
- **AND** it MUST hide `#download-section` ("Get the app" cards), top-nav
  Android and iOS store links, background-page download cards that share
  `#download-section`, the hub lead copy, the Web experiences heading and
  introductory copy, and the NIP-7 info modal bullet recommending mobile app
  install
- **AND** it MUST hide the top-nav Android and iOS links before the header is
  painted, on both the hub and `/web/`, using the `NostrootsBrowser/`
  user-agent marker when available
- **AND** it MUST recheck for an injected Nostroots Browser bridge during
  startup, because some WebViews make that bridge available after page scripts
  begin running
- **AND** it MUST NOT hide Squatbridge or other default web-experience cards
  solely because the client is in-app

#### Scenario: Native iOS header logo

- **GIVEN** the hub or `/web/` loads with a normal iOS Safari user-agent that
  includes the native marker `NostrootsBrowser/1.0 iOS-native`
- **THEN** it MUST hide logo 67 from the web header
- **AND** it MUST keep that logo visible for other in-app shells.

#### Scenario: Compact linked Trustroots identity

- **GIVEN** the hub resolves the connected key to a Trustroots NIP-05 identity
- **WHEN** it renders the connected identity in the header
- **THEN** it MUST show the full NIP-05 username on desktop and a compact `@`
  icon on narrow/mobile headers, while retaining an accessible link to that
  Trustroots profile
- **AND** its hover and keyboard-focus treatment MUST clearly communicate that
  the control opens an explanation
- **AND** on the root hub, the landing lead and the Web experiences heading and
  introductory copy MUST keep the same visible state before and after the linked
  identity resolves, avoiding an identity-dependent layout shift.

#### Scenario: Header identity explanation

- **GIVEN** a user activates the Nostr-key or linked-identity control in a
  shared Vibe Web header
- **WHEN** the control is activated on the hub, background page, or an example
  using the shared header
- **THEN** it MUST open an explanatory modal instead of navigating away
- **AND** when no NIP-07 signer is available, the modal MUST link to the
  Nostroots Android and iOS apps and the Chrome Web Store extension, while
  noting that Firefox support remains under review
- **AND** when a signer is available but has no public key, the modal MUST ask
  the user to generate or import a key in that signer
- **AND** when a public key has no linked Trustroots NIP-05, the modal MUST
  direct the user to `https://www.trustroots.org/profile/edit/networks` to add
  the key to their Trustroots profile
- **AND** when a Trustroots NIP-05 is linked, the modal MUST explain that the
  signer holds the key and that the Trustroots link lets Nostroots recognize
  the account, show an abbreviated `npub` with the full value available to
  assistive technology and hover, and link to Trustroots profile settings for
  changing the association

#### Scenario: Compact web settings modal

- **GIVEN** a user opens Settings in `/web/`
- **WHEN** the settings modal renders
- **THEN** it MUST use reduced top padding and keep the close control in the
  modal's top-right corner

#### Scenario: NIP-07 reorder unchanged

- **GIVEN** a desktop browser with a NIP-07 signer connected on the hub
- **WHEN** the signer is detected
- **THEN** the browser-extensions section MUST hide and the download section MAY
  reorder below web experiences (no-op when the download section is already hidden
  in-app)

### Requirement: Hash-based routing

Nostroots Web MUST use hash routing for current static-host compatibility.

#### Scenario: Reserved routes

- **GIVEN** a user navigates to `#keys`, `#settings`, or `#stats`
- **WHEN** the hash router classifies the route
- **THEN** it MUST open the corresponding modal or stats dashboard.

#### Scenario: Profile routes

- **GIVEN** a user navigates to `#profile`, `#profile/<npub-or-hex-or-nip05>`,
  or a supported `/edit` or `/contacts` suffix
- **WHEN** the hash router classifies the route
- **THEN** it MUST route to self profile, public profile, edit profile, contacts,
  or profile-invalid states according to the documented route shape.

#### Scenario: Map and chat fallback routes

- **GIVEN** a hash contains a full Open Location Code, an `npub`, a hex pubkey,
  a NIP-05 handle, or a circle/channel slug
- **WHEN** the route is classified
- **THEN** plus codes MUST open map-area context, direct identifiers MUST open
  chat/profile-appropriate contexts, and other non-reserved slugs MUST resolve
  as chat channel routes.

### Requirement: Relay and key behavior

Nostroots Web MUST support local keys, NIP-07 browser signing, relay settings,
NIP-42 authenticated relay reads/writes, and leak guards for secret key text.

#### Scenario: Default relays

- **GIVEN** a user has no custom relay settings
- **WHEN** Nostroots Web initializes relay settings
- **THEN** it SHOULD include `wss://nip42.trustroots.org`,
  `wss://relay.trustroots.org`, and `wss://relay.nomadwiki.org`.

#### Scenario: Private key leak guard

- **GIVEN** a user tries to place `nsec` or private-key-like material in a note
  or message
- **WHEN** the app validates the content
- **THEN** it MUST prevent accidental publication of the secret.

### Requirement: Web experiments and examples

Vibe Web MUST keep active experimental pages separate from the current `/web/`
app while allowing them to share Vibe protocol conventions. Retired experiment
paths MAY remain as compatibility redirects to a canonical application.

#### Scenario: Nostrail web experiment

- **GIVEN** a user opens `/nostrail/`
- **WHEN** they use the foreground-only location-sharing prototype
- **THEN** it MUST rely on browser-provided signing/encryption and must not
  claim native background behavior.

#### Scenario: Retired Nostroots Map path

- **GIVEN** a user opens `/nostroots-map/`
- **WHEN** the compatibility page initializes
- **THEN** it MUST redirect to the canonical Map view in `/web/`
- **AND** it MUST NOT initialize a separate map, relay subscription, signer,
  settings, or note-publishing runtime.

#### Scenario: Examples

- **GIVEN** a user opens `/examples/`
- **WHEN** examples are listed or launched
- **THEN** each example MUST remain optional demo/fork material rather than a
  required current app surface.

#### Scenario: Wikistr mobile layout

- **GIVEN** a user opens Wikistr on a narrow/mobile viewport
- **WHEN** its wiki switcher and content render
- **THEN** the five wiki choices MUST remain on one horizontal row and the
  content MUST use the available viewport width
- **AND** when Wikistr runs inside Nostroots Browser, its in-page Logo 67
  header link MUST be hidden.

#### Scenario: Wikistr default wiki

- **GIVEN** a user opens Wikistr without a wiki slug in the URL hash
- **WHEN** the app selects its initial wiki
- **THEN** Nomadwiki MUST be the active wiki by default
- **AND** selecting the active wiki switcher while on one of its subpages MUST
  return the user to that wiki's main page.

#### Scenario: Wikistr edit links

- **GIVEN** a user opens Wikistr on a Nomadwiki page with a linked Trustroots
  NIP-05 identity (`*@trustroots.org`)
- **WHEN** the page heading renders
- **THEN** an Edit control MUST appear beside the page title
- **AND** it MUST open Nomadwiki in a new tab via
  `Special:NostrLogin` with a `returnto` query for the current page and
  `returntoquery=action%3Dedit` (percent-encoded, not a raw `=`)
- **AND** on the Nomadwiki main page the `returnto` value MUST be `Main Page`
- **AND** the Edit control MUST stay hidden on Nomadwiki when no Trustroots
  identity is linked
- **AND** Trashwiki and Trustroots wiki MUST show that Edit control for linked
  identities and open their own `Special:NostrLogin` route with the same
  current-page `returnto` and `returntoquery=action%3Dedit` values.

#### Scenario: Wikistr redirects and missing pages

- **GIVEN** a requested wiki page redirects to another page
- **WHEN** Wikistr receives the parsed target
- **THEN** it MUST update the hash route and page title to that target without
  asking the user to activate the redirect link.
- **AND** MediaWiki red links MUST remain visibly red and open a canonical edit
  URL instead of a relative `/index.php` URL on the Wikistr static site.
- **AND** a linked Nomadwiki identity MUST use the existing `Special:NostrLogin`
  edit route for that missing page.

#### Scenario: Wikistr internal article links

- **GIVEN** a rendered MediaWiki page includes a same-wiki article link
- **WHEN** the link uses either the advertised wiki path or another MediaWiki
  article path with a canonical page title, such as Nomadwiki's `/en/Lisbon`
- **THEN** Wikistr MUST rewrite it to the active wiki's hash route
- **AND** activating it MUST load the target inside Wikistr rather than opening
  the source wiki in a new tab.

#### Scenario: Wikistr protected images

- **GIVEN** a rendered wiki page includes same-wiki image resources
- **THEN** Wikistr MUST load publicly available images directly
- **AND** if a direct image request fails, it MUST retry through the selected
  proxy with NIP-98 authorization and render the returned image data locally,
  so Cloudflare-protected sources such as Trashwiki can remain visible.

#### Scenario: Radiostr social radio example

- **GIVEN** a user opens `/examples/radiostr/`
- **WHEN** they browse stations, chat, or the listening-now panel
- **THEN** the page MUST work read-only without a signer for listening and
  reading the `#radiostr` room
- **AND** posting chat MUST require NIP-07 with a verified Trustroots NIP-05
  (`*@trustroots.org`)
- **AND** posting now-playing notes MUST require NIP-07
- **AND** chat authors MUST be shown by Trustroots NIP-05 when known; messages
  from authors without a Trustroots NIP-05 MUST NOT appear in the chat log
- **AND** starred stations MUST sync via kind `1` favorite notes when NIP-07 is
  available, with `localStorage` as cache when unsigned
- **AND** the listening-now panel MUST appear below starred stations and above
  the remaining channel groups
- **AND** links that leave Radiostr, including listening-now profile links,
  MUST open in a separate tab so the player remains available
- **AND** browsers with Media Session support MUST expose the selected station
  name, Radiostr attribution, and station artwork to system Now Playing
  controls—including Apple system controls and Chrome for Android media
  notifications—with play, pause, previous-station, and next-station actions.

### Requirement: Vibe Web testing guidance

Vibe Web tests MUST focus on high-value behavior and use Docker-first commands
for consistent local and CI feedback.

#### Scenario: Critical-path change

- **GIVEN** a change touches key handling, protocol behavior, routing, or other
  covered critical paths
- **WHEN** the change is prepared for merge
- **THEN** the contributor SHOULD run `make test-fast` or a narrower relevant
  test command from `vibe/web`.
