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
EXPO_DEBUG=1 pnpm run start --dev-client
```

Leave that process running. VS Code should forward port `8081` automatically.

`EXPO_DEBUG=1` enables a browser-friendly React Native DevTools redirect. This
is the default devcontainer workflow because Metro runs in Docker, while the
debugger window should run in your host browser.

After your app connects to Metro, open the development console from the host:

```text
http://localhost:8081/open-debugger
```

If Metro prints an `EDGE_PATH` error after pressing `j` or opening the debugger
from the app menu, the app can still be running correctly. That error only means
the container could not launch a browser. Use the host URL above instead.

To confirm the DevTools console is attached to the app runtime, run:

```js
navigator.product
```

It should return `"ReactNative"`.

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
pnpm exec expo run:android --no-bundler
```

Why Android needs one extra step:

- `adb reverse tcp:8081 tcp:8081` makes `localhost:8081` inside the emulator
  point at Metro on the host
- `--no-bundler` again avoids starting a second Metro process outside Docker

## 4. Run Maestro Against The Host Android Emulator

Maestro can run from the Linux dev container for Android, but the Android
emulator or device still runs on the host. The dev container image includes
Java, `adb`, and the Maestro CLI; rebuild/reopen the dev container after changes
to `.devcontainer/Dockerfile.app`.

On the host, start an emulator and expose the host ADB server to Docker. Run
these commands in a normal host terminal, not in the dev container:

```bash
adb kill-server
adb -a -P 5037 nodaemon server
```

Leave that command running. If you see a `root@...:/app#` prompt, you are still
inside the dev container and are starting the wrong ADB server. In another host
terminal, confirm the host ADB server can see an emulator or device:

```bash
adb devices -l
```

Do not continue until the host command lists a device. If it is empty, launch an
Android emulator or connect a device first. Then install or launch an E2E-enabled
development build from a host terminal:

```bash
cd /path/to/nostroots/nr-app
EXPO_PUBLIC_E2E=1 \
EXPO_PUBLIC_NR_BRIDGE_BASE_URL=http://10.0.2.2:8000 \
EXPO_PUBLIC_NOSTR_RELAYS=ws://10.0.2.2:7777 \
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 \
SENTRY_DISABLE_AUTO_UPLOAD=true \
pnpm exec expo run:android --no-bundler
```

From the container, confirm the same host emulator is visible and the app package
is installed:

```bash
adb devices
adb shell pm list packages org.trustroots.nostroots
```

Then run the Maestro flows from the container:

```bash
cd /app/nr-app
pnpm run test:maestro
```

The dev containers set `ADB_SERVER_SOCKET=tcp:host.docker.internal:5037` and
`MAESTRO_HOST=host.docker.internal`, so the container CLI talks to the host ADB
server. If `adb devices` is empty in the container, fix the host ADB server
before rerunning Maestro.

For iOS Simulator, run Maestro on the macOS host instead of inside Docker. The
Linux container cannot drive Xcode or `xcrun simctl`.

## MongoDB Container

The bridge dev container uses `.devcontainer/nr-bridge/docker-compose.yml` to
start a separate `mongodb` service alongside the app service.

- The app service connects to MongoDB at
  `mongodb://mongodb:27017/trustroots-dev`.
- The initial database name is `trustroots-dev`.
- MongoDB data is stored in the `mongodb-data` Docker volume.
- Port `27017` is forwarded to the host so local tools can connect to the same
  database.
- The app service waits for MongoDB's healthcheck before starting.
- The app image includes the `mailpit` command for capturing verification
  emails.
- The app service is preconfigured with `SMTP_HOST=127.0.0.1` and
  `SMTP_PORT=1025`. Start Mailpit with
  `mailpit --listen 0.0.0.0:8025 --smtp 0.0.0.0:1025`, then open
  `http://localhost:8025`.

Use the bridge dev container when you need the `nr-bridge` Deno app or a seeded
MongoDB instance. Use the Metro-only dev container when you only need Metro.

## Notes

- These commands are for development builds, not Expo Go.
- If Metro is running but the app cannot connect, first check that port `8081`
  is still forwarded by VS Code.
- If you already have the simulator/emulator open, `expo run:ios` or
  `expo run:android` will reuse it.
