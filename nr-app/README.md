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
