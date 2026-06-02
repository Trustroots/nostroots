# Nostroots mobile app.

## Getting started

First, run `pnpm i`.

The fastest way to get started is using Expo go:

In `nr-app`, run `pnpm run start` and choose Expo Go. You can try
starting an emulator or simulator from here if you have it
installed. Alternatively, install the Expo Go app on your mobile
device and scan the QR code.

If you want to use a development build, you can switch to that by
pressing `s`. Open an emulator or simulator with this build using the
commands available.

## Install a development build

You will want to run a development build on an emulator/simulator on your laptop. Run the correct command for your platform:

```
eas build:run --profile development --platform android --latest # android
eas build:run --platform ios --profile simulator --latest # ios
```

NOTE: The following error means that the builds on eas have expired. You can log into GitHub, go to [this page](https://github.com/Trustroots/nostroots/actions/workflows/eas-build.yaml), click "Run workflow", and choose `android-development` or `ios-simulator` (or `ios-development` if you want to run it on your actual iPhone). Afterwards, use `pnpm run start` and select development build and the simulator or device you installed the development build on.

```
Artifacts for the latest build have expired and are no longer available, or this is not a simulator/emulator build.
    Error: build:run command failed.
```

You can also use your physical phone. For Android, you
can use an existing build from
https://expo.dev/accounts/nostroots/projects/nr-app/builds/ . For iOS,
you'd have to register your device first using [this link](https://expo.dev/register-device/2e489efb-3f93-453c-99b0-4567492e6bda).

## Preview builds for testing

We're generating preview builds for android for testing. To create a new preview build, run the "Build in EAS Cloud" GitHub action with `android-preview`. To get the download url for the last created build, run `eas build:list --platform android --build-profile preview --json --non-interactive --status finished --limit 1 | jq '.[0]'.artifacts.buildUrl -r` locally.

To push an update to the people running the preview build, run `eas update --channel preview --message "mymessage"`.

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
