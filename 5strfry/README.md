# 5strfry

Strfry relay with a **NIP-5 write policy**: only events from Trustroots NIP-05 verified pubkeys are accepted, except **kind 0** (metadata), which is accepted from anyone so users can set their profile and NIP-05.

## How it works

- **Kind 0:** Always accepted. If the event’s `content` (JSON) has a `nip05` field ending with `@trustroots.org`, that event’s `pubkey` is added to an allowlist.
- **All other kinds:** Accepted only if the event’s `pubkey` is in the allowlist (i.e. they previously published a kind 0 with Trustroots NIP-05 on this relay).

The allowlist is stored in `allowlist/allowlist.json` and is not committed to git.

## Run

From this directory:

```bash
chmod +x plugin/run.sh
docker compose up -d
```

Relay URL: `ws://localhost:7777`.

## Connecting from nr-web

1. **Start 5strfry:** `docker compose up -d` in this directory (so the relay is listening on port 7777).
2. In nr-web (e.g. http://localhost:8765), open **Settings** and add relay URL **`ws://localhost:7777`** (must start with `ws://` or `wss://`, not `http://` or plain `localhost:7777`).
3. If it still fails to connect: check the browser devtools **Console** for the error; ensure nothing else is using port 7777; try `ws://127.0.0.1:7777` instead of `ws://localhost:7777`.

## Deployment

Deployed on the wiki server at **5str.nomadwiki.org** (wss://5str.nomadwiki.org).

## Test

1. Connect a Nostr client to `ws://localhost:7777`.
2. Publish a kind 0 (set metadata) with `nip05` set to e.g. `yourname@trustroots.org`; it will be accepted and your pubkey will be added to the allowlist.
3. Publish other kinds (e.g. kind 1 notes); they will be accepted only if your pubkey is already on the allowlist.

## Configuration

- **ALLOWLIST_PATH** (env): Path to the allowlist JSON file inside the container (default: `/app/allowlist/allowlist.json`).
- **TRUSTROOTS_NIP05_DOMAIN** (env): NIP-05 domain suffix (default: `trustroots.org`). The plugin accepts `nip05` values ending with `@<this value>`.

Set in `docker-compose.yml` under the `strfry` service `environment`.

## Base image

The Dockerfile uses `thesamecat/strfry:latest` and compiles the NIP-5 plugin to a standalone binary (no Deno in the final image). If that image is unavailable, change the Dockerfile to use e.g. `ghcr.io/trustroots/strfry:master` and install Deno in the image (e.g. with `apt-get` or by copying the Deno binary from a `denoland/deno` stage).

## AMD64 vs ARM (Apple Silicon)

The Compose file sets **`platform: linux/amd64`** so the image matches the strfry base and runs on typical Linux servers (e.g. the deployment host).

**On Apple Silicon (ARM) Macs:**

- Docker runs the amd64 image via emulation (Rosetta). The write-policy plugin is a compiled amd64 binary; it can fail inside the container with:
  - `exec: /app/plugin/nip5-policy: not found`, or
  - `rosetta error: failed to open elf at /lib64/ld-linux-x86-64.so.2`
- When the plugin fails, strfry reports **`error: internal error`** for every write and events are rejected.

**What to do:**

- **Production / deployment:** Build and run on an **amd64 Linux** host (e.g. the wiki server). The same image works there.
- **Local testing on ARM Mac:** Either test against the deployed relay (wss://5str.nomadwiki.org), or build and run 5strfry on an amd64 machine/VM. Removing `platform: linux/amd64` and building natively produces an ARM binary, but the strfry base image is amd64-only, so the plugin would still not run inside the container.
