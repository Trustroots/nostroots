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

Android Maestro E2E uses GitHub Actions with a locally prebuilt Android project,
a Gradle-built debug APK, Metro, and the deterministic local E2E network. iPhone
Maestro E2E runs on a macOS GitHub Actions runner with a local iOS simulator
build, Metro, and the same deterministic bridge, relay, and mail services. The
EAS `e2e-ios-simulator` smoke remains available for hosted iOS checks.

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

### iOS

iOS development only works if you're running macOS and you need to
install XCode.

From a normal macOS host terminal, not the dev container:

```bash
cd /path/to/nostroots/nr-app
REACT_NATIVE_PACKAGER_HOSTNAME=localhost \
SENTRY_DISABLE_AUTO_UPLOAD=true \
pnpm exec expo run:ios --no-bundler
```

## Running iPhone Maestro E2E On macOS

iPhone E2E runs from a normal macOS host terminal because Xcode simulators are
not available inside the Linux dev container. The scripts use `127.0.0.1` for
the local bridge and relay URLs, and write logs under `.e2e-logs/ios/`.

Install local service dependencies with Homebrew if you want to mirror CI:

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0 mongosh mailpit
```

Build and install the E2E development client on a booted iPhone simulator:

```bash
cd /path/to/nostroots/nr-app
pnpm run ios:e2e:simulator:reset
pnpm run build:ios-e2e-local
```

The simulator helper picks an available iPhone simulator by default. To choose a
specific simulator:

```bash
IOS_SIMULATOR_NAME="iPhone 16 Pro" pnpm run ios:e2e:simulator:reset
IOS_SIMULATOR_UDID=<simulator-udid> pnpm run ios:e2e:simulator:reset
```

Start the deterministic E2E services from the repository root, then run Maestro
from `nr-app`:

```bash
cd /path/to/nostroots
docker compose -f nr-app/e2e/docker-compose.yml up -d --build

cd nr-app
pnpm run test:maestro:ios:local
pnpm run test:maestro:ios:local -- .maestro/smoke.yaml
```

`test:maestro:ios:local` starts or reuses Metro on port `8081`, launches the
Expo dev-client URL in the booted simulator, opens the E2E reset deep link, and
runs temporary copies of the Maestro flows with `launchApp` removed. This keeps
the dev client attached to the selected Metro project instead of reopening the
development-server picker.

### Android

Android development on macOS needs host-side Android tooling because the emulator
runs on the Mac, even when Metro runs in the dev container.

Host install requirements:

- Node 24 (`nvm use 24` if you use nvm).
- Java/JDK 17. With Homebrew:

  ```bash
  brew install openjdk@17
  sudo ln -sfn "$(brew --prefix openjdk@17)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-17.jdk
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  export PATH="$JAVA_HOME/bin:$PATH"
  java -version
  ```

- Android Studio. With Homebrew:

  ```bash
  brew install --cask android-studio
  ```

- Android SDK in `~/Library/Android/sdk`. Add tools to your host shell:

  ```bash
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
  ```

- An Android Virtual Device. In Android Studio, open Device Manager, create a
  device, and download a Google APIs `x86_64` system image for Intel Macs. Avoid
  ARM images on Intel Macs.

You can start an emulator from the host terminal after creating it:

```bash
emulator -list-avds
emulator -avd Pixel_10_Pro -no-snapshot-load
```

If the emulator stays offline, do a one-time wipe:

```bash
emulator -avd Pixel_10_Pro -wipe-data -no-snapshot-load
```

### Metro Dev Container

`.devcontainer/metro/devcontainer.json` sets up a vscode docker container to run the Metro bundler on.

## Running Android With Metro In The Dev Container

This workflow runs Metro in Docker and the Android emulator/build tools on the
Mac host. Commands must run in the listed locations.

The repeated E2E environment variables are wrapped in package scripts. The host
steps still need host-side Android tooling, but the dev-container Metro and
Maestro steps can be run together with the local Maestro wrapper below.

### 1. Start Metro in the dev container

In the dev container:

```bash
cd /app/nr-app
pnpm run android:e2e:metro
```

Leave Metro running.

### 2. Start the Android emulator on the host

In a host macOS terminal:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
pnpm run android:e2e:emulator:reset
```

The helper assumes `Pixel_10_Pro` exists, stops any currently connected
emulator session, restarts host ADB on all interfaces, starts the emulator,
waits for Android boot completion, unlocks it, and restores
`adb reverse tcp:8081 tcp:8081`. Logs are written under
`.e2e-logs/android/` in `nr-app`, which is visible from the dev container at
`/app/nr-app/.e2e-logs/android/`. To use another AVD:

```bash
AVD_NAME=Other_Avd_Name pnpm run android:e2e:emulator:reset
```

If the emulator is visibly stuck, blank, or not rendering, do a one-time hard
reset. `WIPE_DATA=1` clears the emulator data partition, and software GPU mode
can help recover from host GPU rendering issues:

```bash
WIPE_DATA=1 EMULATOR_EXTRA_ARGS="-gpu swiftshader_indirect" pnpm run android:e2e:emulator:reset
```

To check the emulator manually:

```bash
adb wait-for-device
adb shell getprop sys.boot_completed
adb devices -l
```

`sys.boot_completed` should print `1`, and `adb devices -l` should show
`emulator-5554 device`, not `offline`.

### 3. Expose host ADB to the dev container

In a host terminal:

```bash
cd /path/to/nostroots/nr-app
pnpm run android:e2e:adb:host
```

This restarts the host ADB server on all interfaces, waits for the emulator to
finish booting, runs `adb reverse tcp:8081 tcp:8081`, and prints the device list.

The bridge and Metro dev containers set
`ADB_SERVER_SOCKET=tcp:host.docker.internal:5037` and
`MAESTRO_HOST=host.docker.internal`, so container commands talk to this host ADB
server.

### 4. Build and install the Android app from the host

In a host terminal:

```bash
cd /path/to/nostroots/nr-app
pnpm run android:e2e:install
```

The install wrapper builds the debug APK with Gradle, installs it with `adb
install`, and intentionally does not launch the app. This keeps the emulator
reset/install steps independent of Metro and the dev container. The wrapper
streams output to the terminal and writes logs under `.e2e-logs/android/`,
including `install-latest.log`, which is visible from the dev container at
`/app/nr-app/.e2e-logs/android/`.

The generated `android/` directory is reused without re-applying config plugins.
After changing native config (app scheme, `expo-dev-client` options, plugins in
`app.json`/`app.config.js`), regenerate the native project first, then reinstall:

```bash
pnpm run android:e2e:prebuild
adb uninstall org.trustroots.nostroots
pnpm run android:e2e:install
```

A stale `android/` project is easy to spot: check
`android/app/src/main/AndroidManifest.xml` for an old scheme such as `myapp` or
for missing `EXDevMenu*` meta-data entries.

### 5. Run Android Maestro flows from the dev container

In the dev container:

```bash
cd /app/nr-app
pnpm run android:e2e:adb:check
pnpm run test:maestro
```

The package check should print a `package:/.../base.apk` path. If Maestro reports
`Unable to launch app org.trustroots.nostroots`, the app is not installed on the
emulator yet.

For a one-command local run from the dev container, after the host emulator,
host ADB bridge, and app install steps above are ready:

```bash
cd /app/nr-app
pnpm run test:maestro:local
```

`test:maestro:local` checks the installed package, restores
`adb reverse tcp:8081 tcp:8081`, reuses Metro if it is already running on port
`8081`, or starts Metro with the Android E2E environment if needed. It only stops
Metro when it started Metro itself. Local dev-client runs use temporary flow
copies with `launchApp` removed so Maestro does not reopen Expo's development
launcher instead of the selected Metro project. The wrapper prewarms the Android
bundle directly from Metro, launches the dev client with `disableOnboarding=1`,
then opens the E2E reset route and waits for `screen-welcome` before running the
requested flow. This avoids first-run Metro bundling and dev-launcher races. To
run one flow:

```bash
pnpm run test:maestro:local -- .maestro/smoke.yaml
```

When `EXPO_PUBLIC_E2E=1`, the development build is configured with Expo
dev-client `launchMode: most-recent` and a default launch URL of
`http://10.0.2.2:8081?disableOnboarding=1` for Android E2E or
`http://127.0.0.1:8081?disableOnboarding=1` for iOS E2E, so app launches should
reopen the Metro project instead of the development-server picker. The same
E2E-only dev-client config marks the Expo dev menu onboarding as finished and
disables showing the dev menu and floating dev button at launch, so the dev menu
does not cover Maestro selectors on Android or iOS. Rebuild and reinstall the
app after changing this native config.

This means an E2E-installed development build is slightly different from a
normal development build: the Expo dev menu will not open automatically, the dev
menu onboarding is skipped, and the floating dev tools button is hidden. If you
want the normal Expo dev-client experience again, rebuild/reinstall without
`EXPO_PUBLIC_E2E=1`. If an older dev build has already shown the onboarding,
uninstall the app or clear app data once before reinstalling so Expo's stored
dev-menu preferences do not override the new defaults.

CI uses the same local development-build shape as this flow: Expo prebuild
regenerates `android/`, Gradle creates a debug APK, the emulator installs it,
and `test:maestro:local` starts Metro before running Maestro. This avoids EAS
Android build credits at the cost of keeping Metro alive during the CI smoke.

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
