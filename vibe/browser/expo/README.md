# Nostroots Browser (Expo)

Standalone Expo implementation of Nostroots Browser for iOS and Android. The native SwiftUI app in [`../ios/`](../ios/) remains the production source of truth for iOS behavior; this app prioritizes matching its browser/key/NIP-07 behavior and making the same web experience usable from Expo.

This package is intentionally not part of the root pnpm workspace. Install and run from this directory.

```bash
cd vibe/browser/expo
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm test
pnpm lint
```

From the repo root, build (when needed) and open the iOS Simulator:

```bash
vibe/browser/scripts/run-expo-simulator.sh
```

Optional: `CLEAN_BUILD=1` for a full native rebuild, `SIMULATOR_NAME="iPhone 16"` to pick a device.

The app loads `https://nos.trustroots.org/`, injects a native-backed `window.nostr`, stores its own key in Expo SecureStore, prompts for NIP-07 access on non-trusted developer-mode origins, and exposes a notification stub for v1. Native push notifications and EAS build profiles are intentionally out of scope for this first pass.
