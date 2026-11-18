# nostroots-server

This is a deno app that runs on the server to watch for 30397 events, check that
they have a valid NIP05 on trustroots.org, and then post a matching 30398 event.

Set `PRIVATE_KEY_NSEC` to the validation server's existing signing key before
starting or deploying it. Outside development, missing, blank, or invalid keys
stop startup rather than silently creating a new signing identity. Existing
valid configured keys are unchanged.

For local development, `IS_DEV=true` allows an ephemeral key when
`PRIVATE_KEY_NSEC` is unset or blank. Only its public key is logged; it changes
after each restart. An invalid configured key is rejected in development too.

Run the signing-key configuration tests with:

    deno test src/private-key.test.ts

In order to load `nr-common` into docker, we use a multi context build. To build
it locally you can run:

    docker buildx build --build-context nr-common=../nr-common .

This exposes the `nr-common` folder as `nr-common` inside docker, hence the
first lines of `Dockerfile`.

Add the `--load` line if you're getting no image and a warning about no output
being specified.
