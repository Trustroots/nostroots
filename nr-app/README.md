# Nostroots mobile app.

## Getting stated as a developer on the team

Create an eas account on expo.dev. Request to be added to the nostroots team. Afterwards, run, depending on your preferred development platform:

```
pnpm dlx eas-cli build:run --profile development --platform android --latest # android
pnpm dlx eas-cli build:run --platform ios --profile simulator --latest # ios
```

Afterwards, use `pnpm run start` and select development build and the simulator or device you installed the development build on.

You can also use your physical phone. For Android, you
can use an existing build from
https://expo.dev/accounts/nostroots/projects/nr-app/builds/ . For iOS,
you'd have to register your device first using [this link](https://expo.dev/register-device/2e489efb-3f93-453c-99b0-4567492e6bda).

## Getting started with local build

`pnpm run start`

## Testing

See [`TESTING.md`](./TESTING.md) for the full nr-app testing guide.

Common commands:

```bash
pnpm --filter nr-app test
pnpm --filter nr-app test:coverage
pnpm --filter nr-app test:ci
```

Android Maestro E2E uses GitHub Actions with an EAS-built `e2e-android` APK and
the deterministic local E2E network. iOS Maestro smoke runs through EAS using
the `e2e-ios-simulator` profile.

Required/repeatable tests must never rely on live Trustroots, public Nostr
relays, or real email delivery.

## Preview builds for testing

We're generating preview builds for android for testing. To create a new preview build, run the ["Build in EAS Cloud" GitHub action](https://github.com/Trustroots/nostroots/actions/workflows/eas-build.yaml) with `android-preview`.

### Automatic releases

After a preview build completes, a GitHub release is automatically created with the `.apk` file. You can:

- View all [preview releases](https://github.com/Trustroots/nostroots/releases?q=preview)
- Download the `.apk` directly from the release
- Install on Android using: `adb install -r app-preview.apk`

You can also manually trigger a release creation using the ["Create Release from EAS Build" GitHub action](https://github.com/Trustroots/nostroots/actions/workflows/create-release-from-eas-build.yaml).

### Getting the APK locally

To get the download URL for the last created build, run:

```bash
eas build:list --platform android --build-profile preview --json --non-interactive --status finished --limit 1 | jq '.[0]'.artifacts.buildUrl -r
```

### Pushing updates

To push an update to the people running the preview build, run:

```bash
eas update --channel preview --message "your message here"
```

### Local network

For Expo Go to work on a physical phone they need to be connected to
the same local network. Using a VPN on the development laptop and/or
on the phone can cause issues with this.

### Android

Android Studio seems bloated but it's a good way to get a working
Android emulator.

macOS notes:

- `brew install android-studio`
- use `~/Library/Android`

### iOS

iOS development only works if you're running macOS and you need to
install XCode.

### Metro Dev Container

`.devcontainer/metro/devcontainer.json` sets up a vscode docker container to run the Metro bundler on.

In the local (non-docker container) run the expo command to get the simulator:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=localhost SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --no-bundler
```

## Local nr-bridge email verification flow

This flow is for testing Trustroots account verification emails and deep links
with the iOS Simulator. It requires a development build, not Expo Go, because
Expo Go cannot register the app's custom `nostroots://` URL scheme.

### 1. Reset the app scheme for deep links

The app scheme is configured in `app.json` and `app.config.js`. Before building,
check that Expo resolves the expected scheme:

```bash
cd nr-app
EXPO_PUBLIC_NR_BRIDGE_BASE_URL=http://localhost:8000 npx expo config --type public | grep scheme
```

The output should include `nostroots`. If it still shows an old scheme such as
`myapp`, make sure `app.json` and `app.config.js` both use `nostroots`.

Scheme changes are native iOS configuration, so Metro reloads are not enough.
Regenerate the iOS native project and reinstall the simulator app:

```bash
EXPO_PUBLIC_NR_BRIDGE_BASE_URL=http://localhost:8000 npx expo prebuild --platform ios --clean

xcrun simctl uninstall booted org.trustroots.nostroots

EXPO_PUBLIC_NR_BRIDGE_BASE_URL=http://localhost:8000 \
REACT_NATIVE_PACKAGER_HOSTNAME=localhost \
SENTRY_DISABLE_AUTO_UPLOAD=true \
npx expo run:ios --no-bundler
```

After installing, confirm the simulator build registered `nostroots`:

```bash
APP_BUNDLE="$(xcrun simctl get_app_container booted org.trustroots.nostroots app)"
plutil -p "$APP_BUNDLE/Info.plist" | grep -A20 CFBundleURLTypes
```

### 2. Run Metro

In the dev container:

```bash
cd /app/nr-app
EXPO_PUBLIC_NR_BRIDGE_BASE_URL=http://localhost:8000 \
EXPO_DEBUG=1 \
pnpm run start --dev-client --clear
```

### 3. Run Mailpit

Mailpit captures the verification emails sent by `nr-bridge` during local
development.

In the dev container:

```bash
mailpit --listen 0.0.0.0:8025 --smtp 0.0.0.0:1025
```

Open Mailpit on the host:

```text
http://localhost:8025
```

### 4. Run nr-bridge

In the dev container:

```bash
cd /app/nr-bridge
deno task dev
```

The bridge runs at `http://localhost:8000`. In the local dev container setup it
uses Mailpit SMTP on `127.0.0.1:1025`, so verification emails appear in Mailpit
instead of going to real inboxes.

### 5. Test a verification email deep link in iOS Safari

Start verification inside the app first by entering a Trustroots username and
requesting the email. This stores the pending username in app state; the email
deep link only contains the token.

Then:

1. Open `http://localhost:8025` and open the verification email.
2. Copy the `nostroots://verify?token=...` link.
3. Open Safari in the iOS Simulator.
4. Paste the `nostroots://verify?token=...` link into Safari's address bar and
   press Go.

If Safari says the address is invalid, the installed simulator app probably does
not register `nostroots://`. Re-run the scheme reset and rebuild steps above,
then check `CFBundleURLTypes` again.
