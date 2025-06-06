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

## Run a development build

You will want to run a development build on an emulator/simulator on your laptop. Run the correct command for your platform:

```
eas build:run --profile development --platform android --latest # android
eas build:run --platform ios --profile simulator --latest # ios
```

NOTE: The following error means that the builds on eas have expired. You can log into GitHub, go to [this page](https://github.com/Trustroots/nostroots/actions/workflows/eas-build.yaml), click "Run workflow", and choose your.

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
