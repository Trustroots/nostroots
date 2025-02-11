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

If you want to run a development build on your phone, you'll have to
download the latest app and scan the QR code with it. For Android, you
can use an existing build from
https://expo.dev/accounts/nostroots/projects/nr-app/builds/ . For iOS,
you'd have to register your device first using `eas devices` and then
make a build.


## Notes

### Local network

For Expo Go to work on a physical phone they need to be connected to
the same local network.  Using a VPN on the development laptop and/or
on the phone can cause issues with this.


### Android

Android Studio seems bloated but it's a good way to get a working
Android emulator.

macOS notes:
* `brew install android-studio`
* use `~/Library/Android`


### iOS

iOS development only works if you're running macOS and you need to
install XCode.