# Metro Dev Container

This dev container is for running the `nr-app` Metro bundler inside Docker
while the iOS Simulator or Android emulator runs on your Mac.

The container defined in `.devcontainer/metro/devcontainer.json`:

- mounts the repo at `/app`
- installs dependencies with `pnpm install --frozen-lockfile`
- forwards Metro on port `8081`

That means Metro lives in the container, but the simulator/emulator connects to
it through `localhost:8081` on the host machine.

## 1. Start Metro in the container

Open the repo in the Metro dev container, then start Metro inside the container:

```bash
cd /app/nr-app
pnpm run start --dev-client
```

Leave that process running. VS Code should forward port `8081` automatically.

## 2. Run the iOS Simulator from the host

From a normal macOS terminal, not the container:

```bash
cd /Users/akira/code/js/nostroots/nr-app
REACT_NATIVE_PACKAGER_HOSTNAME=localhost \
SENTRY_DISABLE_AUTO_UPLOAD=true \
npx expo run:ios --no-bundler
```

Why this works:

- `--no-bundler` stops Expo from trying to start a second Metro process locally
- `REACT_NATIVE_PACKAGER_HOSTNAME=localhost` makes the app use the forwarded
  Metro port on your Mac

## 3. Run the Android emulator from the host

Start an Android emulator on the host, then run:

```bash
adb reverse tcp:8081 tcp:8081
cd /Users/akira/code/js/nostroots/nr-app
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 \
SENTRY_DISABLE_AUTO_UPLOAD=true \
npx expo run:android --no-bundler
```

Why Android needs one extra step:

- `adb reverse tcp:8081 tcp:8081` makes `localhost:8081` inside the emulator
  point at Metro on the host
- `--no-bundler` again avoids starting a second Metro process outside Docker

## Notes

- These commands are for development builds, not Expo Go.
- If Metro is running but the app cannot connect, first check that port `8081`
  is still forwarded by VS Code.
- If you already have the simulator/emulator open, `expo run:ios` or
  `expo run:android` will reuse it.
