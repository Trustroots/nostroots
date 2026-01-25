# Nostroots Web App

A web application that replicates the functionality of the nostroots mobile app, providing a map-based interface for sharing notes on the Nostr network.

## Features

- **Interactive Map**: View notes from various sources displayed on a Leaflet-based map
- **Layer Toggles**: Filter notes by source (Trustroots, Hitchmap, Hitchwiki, Unverified)
- **Note Posting**: Add notes to any location by right-clicking on the map
- **Event List**: View all events fetched from the relay
- **Key Management**: Generate new keys or import existing ones (nsec or mnemonic)
- **Persistent Settings**: Your keys and preferences are stored locally

## Getting Started

### Prerequisites

- Node.js 18+ (or use the `.nvmrc` from the root)
- pnpm (see root `package.json` for version)

### Installation

From the repository root:

```bash
pnpm install
```

### Development

```bash
cd nr-web
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## Architecture

### Tech Stack

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **Leaflet / react-leaflet 5** - Interactive maps
- **nostr-tools** - Nostr protocol implementation
- **Zustand** - State management with persistence
- **Tailwind CSS** - Styling

### Project Structure

```
nr-web/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Map view (home)
│   │   ├── list/         # Event list view
│   │   └── settings/     # Settings/identity page
│   ├── components/       # React components
│   │   ├── MapView.tsx   # Main map component
│   │   ├── LayerToggle.tsx
│   │   ├── AddNoteModal.tsx
│   │   └── Navigation.tsx
│   ├── lib/              # Utility functions
│   │   ├── events.ts     # Event creation helpers
│   │   ├── keys.ts       # Key management
│   │   └── utils.ts      # General utilities
│   ├── store/            # Zustand store
│   │   └── nostr.ts      # Nostr state management
│   └── types/            # TypeScript declarations
├── public/               # Static assets
└── tailwind.config.ts    # Tailwind configuration
```

### Key Components

1. **MapView** (`src/components/MapView.tsx`)
   - Renders the Leaflet map
   - Displays markers for notes with location data
   - Handles map interactions (right-click to add note)

2. **Nostr Store** (`src/store/nostr.ts`)
   - Manages connection to the relay
   - Stores events and user identity
   - Persists keys and preferences to localStorage

3. **Event Utilities** (`src/lib/events.ts`)
   - Creates properly formatted nostr events
   - Handles Plus Code (Open Location Code) tagging

## Relay Connection

The app connects to `wss://relay.trustroots.org` and subscribes to:
- Kind 30397 (Map Notes)
- Kind 30398 (Verified Notes / Reposts)
- Kind 30399 (External notes from Hitchmap, etc.)
- Kind 10390 (Trustroots Profiles)

## Usage

### Viewing Notes

1. Open the app - it automatically connects to the relay
2. Use layer toggles (top-left) to filter which sources to display
3. Click on markers to see note details

### Adding Notes

1. Go to Settings and set up your identity (generate or import keys)
2. Right-click anywhere on the map
3. Enter your note content and publish

### Managing Keys

From the Settings page, you can:
- Generate new nostr keys
- Import existing keys via nsec
- Import via 12-word mnemonic
- View your public key (npub)
- Show/hide your private key

## Relation to Mobile App

This web app provides similar functionality to the `nr-app` mobile app:
- Uses the same relay
- Uses the same event formats (via `@trustroots/nr-common`)
- Supports the same map layers
- Compatible key formats

## Contributing

See the main repository README for contribution guidelines.
