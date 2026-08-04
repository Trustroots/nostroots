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

## Running

Build and install a **Release** build on the simulator:

```bash
cd nr-app
SENTRY_DISABLE_AUTO_UPLOAD=true pnpm exec expo run:ios --configuration Release
```

Then, with the simulator running:

```bash
cd nr-app
pnpm test:e2e
```

Run one flow:

```bash
maestro test .maestro/flows/onboarding-import.yaml
```

To watch a flow while iterating on it, `maestro test --continuous <file>`.

### Why Release and not a dev build

A dev build does not work for these flows. `launchApp: clearState: true` wipes
the dev client's stored Metro URL, so it lands on "No development servers
found"; sending it back to Metro with a deep link then triggers the dev client's
developer-menu sheet, whose text is not in the accessibility hierarchy and so
cannot be reliably dismissed. A Release build embeds the JS bundle, needs no
Metro, and gives a genuine cold start.

`SENTRY_DISABLE_AUTO_UPLOAD=true` is needed because the Release build otherwise
runs sentry-cli source map upload, which fails without an auth token.

## Flows

| Flow | What it covers |
| --- | --- |
| `flows/onboarding-generate.yaml` | Fresh install through to a newly generated mnemonic, ending on the link screen |
| `flows/onboarding-import.yaml` | Fresh install importing a fixed test nsec, asserting the derived npub on the link screen |

Both share `subflows/open-key-screen.yaml`, which wipes state and walks to the
key step.

## What is not covered, and why

`app/onboarding/trustroots.tsx` is the primary onboarding branch. It requests a
six-digit code through `nr-bridge` and delivers it by email, so it cannot be
driven end to end without a mock bridge. The flows take the legacy key path
instead (`Set up my key manually`).

Both flows stop at the link screen. `link.tsx` gates its Finish button on a live
NIP-05 lookup against trustroots.org that must match the local npub, so reaching
the home screen needs a real linked Trustroots account.

## Known deviation: the welcome screen

A fresh install lands on `onboarding/identity`, not `welcome`. `app/index.tsx`
renders `Redirect -> WELCOME`, but its own effect sets `hasBeenOpenedBefore` in
the same commit, and the re-render swaps in `Redirect -> ONBOARDING` before the
first redirect navigates.

The subflow encodes this current behaviour so the flows pass. It is a deviation
from what the code intends, not a decision. If the redirect race is fixed, add
the `welcome-get-started` tap back to the top of the subflow.

## Selectors

Flows select on `testID`, never on visible copy, so rewording a button does not
break them. When you add a control that a flow needs to reach, give it a
`testID` rather than matching its text.

## CI

These do not run in CI. `.github/workflows/test.yml` is a plain ubuntu Node and
Deno job with no simulator, and adding one would put roughly twenty slow minutes
on every push. Run them locally when you touch onboarding.
