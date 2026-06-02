# Dev Container Mobile Workflow

Use a dev container to run the `nr-app` Metro bundler inside Docker while the
iOS Simulator or Android emulator runs on your Mac.

Any dev container used for this workflow should:

- mount the repo at `/app`
- use the shared `.devcontainer/Dockerfile.app` app image
- install dependencies with `pnpm install --frozen-lockfile`
- forward Metro on port `8081`

That means Metro lives in the container, but the simulator/emulator connects to
it through `localhost:8081` on the host machine.

The Metro-only dev container starts just the app image. The bridge dev container
starts the same app image plus MongoDB, so Metro can run from either one.

## 1. Start Metro in the container

Open the repo in a dev container, then start Metro inside that container:

```bash
cd /app/nr-app
pnpm run start --dev-client
```

Leave that process running. VS Code should forward port `8081` automatically.

## 2. Run the iOS Simulator from the host

From a normal macOS terminal, not the container:

```bash
cd /path/to/nostroots/nr-app
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
cd /path/to/nostroots/nr-app
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 \
SENTRY_DISABLE_AUTO_UPLOAD=true \
npx expo run:android --no-bundler
```

Why Android needs one extra step:

- `adb reverse tcp:8081 tcp:8081` makes `localhost:8081` inside the emulator
  point at Metro on the host
- `--no-bundler` again avoids starting a second Metro process outside Docker

## MongoDB Container

The bridge dev container uses `.devcontainer/nr-bridge/docker-compose.yml` to
start a separate `mongodb` service alongside the app service.

- The app service connects to MongoDB at `mongodb://mongodb:27017/trustroots-dev`.
- The initial database name is `trustroots-dev`.
- MongoDB data is stored in the `mongodb-data` Docker volume.
- Port `27017` is forwarded to the host so local tools can connect to the same
  database.
- The app service waits for MongoDB's healthcheck before starting.

Use the bridge dev container when you need the `nr-bridge` Deno app or a seeded
MongoDB instance. Use the Metro-only dev container when you only need Metro.

## Notes

- These commands are for development builds, not Expo Go.
- If Metro is running but the app cannot connect, first check that port `8081`
  is still forwarded by VS Code.
- If you already have the simulator/emulator open, `expo run:ios` or
  `expo run:android` will reuse it.
