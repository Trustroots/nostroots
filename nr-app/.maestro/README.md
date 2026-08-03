# nr-app end-to-end tests

[Maestro](https://maestro.mobile.dev) flows covering onboarding.

## Setup

Install the Maestro CLI once:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

It appends itself to your shell profile. Open a new shell, or:

```bash
export PATH="$PATH:$HOME/.maestro/bin"
```

The flows also need [Deno](https://deno.com) on `PATH`, to run the mock stack.

## Mock stack

The flows need an nr-bridge, a Trustroots NIP-05 endpoint and a relay.
`.maestro/mock-stack/server.ts` is all three, on port 8787: it accepts any
username, always issues the code `123456`, serves one fixed test identity at
`/.well-known/nostr.json`, and acknowledges any event published to it.

`.maestro/.env.e2e` points the app at it. Expo does not load that file
automatically, so `pnpm test:e2e:build` and `scripts/e2e.sh` source it. The
resulting build talks to localhost and must never be distributed.

Its own tests: `cd .maestro/mock-stack && deno task test`.

## Running

Build and install a **Release** build on the simulator:

```bash
cd nr-app
pnpm test:e2e:build
```

Then, with the simulator running:

```bash
cd nr-app
pnpm test:e2e
```

This starts the mock stack, runs the flows, and stops the mock stack again.

Run one flow:

```bash
./scripts/e2e.sh .maestro/flows/onboarding-import.yaml
```

To iterate on a flow, run the mock stack and Maestro separately:

```bash
cd .maestro/mock-stack && deno task start
```

```bash
maestro test --continuous .maestro/flows/onboarding-import.yaml
```

If more than one simulator is booted, Maestro's choice of device is ambiguous,
because `scripts/e2e.sh` does not pick one. Name the device instead — the
script forwards its arguments to Maestro:

```bash
./scripts/e2e.sh --device <udid>
```

`xcrun simctl list devices booted` lists the candidates. Running Maestro
directly, without the mock stack, the flag goes before `test`:

```bash
maestro --device <udid> test .maestro/flows
```

### Why Release and not a dev build

A dev build does not work for these flows. `launchApp: clearState: true` wipes
the dev client's stored Metro URL, so it lands on "No development servers
found"; sending it back to Metro with a deep link then triggers the dev client's
developer-menu sheet, whose text is not in the accessibility hierarchy and so
cannot be reliably dismissed. A Release build embeds the JS bundle, needs no
Metro, and gives a genuine cold start.

`SENTRY_DISABLE_AUTO_UPLOAD=true` is needed because the Release build otherwise
runs sentry-cli source map upload, which fails without an auth token; it is set
by `pnpm test:e2e:build` already, not something you need to pass yourself.

## Flows

| Flow                             | What it covers                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `flows/onboarding-bridge.yaml`   | The primary branch: welcome, identity, Trustroots email verification through the mock bridge, backup confirmation, home |
| `flows/onboarding-generate.yaml` | Fresh install through to a newly generated mnemonic, ending on the link screen                                          |
| `flows/onboarding-import.yaml`   | Fresh install importing a fixed test nsec, through NIP-05 linking to home, then a relaunch that must land on home       |

`onboarding-generate.yaml` and `onboarding-import.yaml` share
`subflows/open-key-screen.yaml`, which wipes state and walks to the key step via
the legacy key path. `onboarding-bridge.yaml` takes the Trustroots email path
instead, so it does not use that subflow.

## What is not covered, and why

`flows/onboarding-generate.yaml` stops at the link screen. That flow generates a
random key, so the NIP-05 lookup in `link.tsx` cannot be made to match it
deterministically; the mock stack serves one fixed test identity. The import
flow covers the link screen and everything past it.

The bridge error branches (`not-found`, `already-pending`, a rejected code, a
failed profile publish) are covered by `app/onboarding/trustroots.test.tsx`
rather than by flows, because driving them through the UI is slower and no more
convincing.

## Known issue: `pnpm test:e2e:build` in a git worktree

In a git worktree, `pnpm test:e2e:build` currently fails: `expo prebuild` dies
with `ENOENT ... assets/images/nostroots-logo67-app-icon.png` from inside
`@expo/image-utils`. This is unrelated to onboarding or the mock stack — it is
an `expo prebuild` / worktree interaction.

The workaround that worked: copy an already-generated `nr-app/ios` directory
from a normal checkout that has one, run `pod install` inside it, then build
directly with `xcodebuild`:

```bash
xcodebuild -workspace Nostroots.xcworkspace -scheme Nostroots \
  -configuration Release -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<udid>' \
  -derivedDataPath ./build-e2e
```

A full Release build needs roughly 7 GB of derived data. To iterate on
JS-only changes without a full rebuild, regenerate the bundle with
`expo export:embed` and the Pods `hermesc`, then swap the resulting
`main.jsbundle` into the already-installed `.app` instead of rebuilding.

This is a workaround, not the intended path — fix `expo prebuild` in worktrees
if you hit this outside of e2e work.

## Selectors

Flows select on `testID`, never on visible copy, so rewording a button does not
break them. When you add a control that a flow needs to reach, give it a
`testID` rather than matching its text.

## CI

These do not run in CI. `.github/workflows/test.yml` is a plain ubuntu Node and
Deno job with no simulator, and adding one would put roughly twenty slow minutes
on every push. Run them locally when you touch onboarding.
