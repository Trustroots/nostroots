# nostroots-server

This is a deno app that runs on the server to watch for 30397 events, check that
they have a valid NIP05 on trustroots.org, and then post a matching 30398 event.

In order to load `nr-common` into docker, we use a multi context build. To build
it locally you can run:

    docker buildx build --build-context nr-common=../nr-common .

This exposes the `nr-common` folder as `nr-common` inside docker, hence the
first lines of `Dockerfile`.

Add the `--load` line if you're getting no image and a warning about no output being specified.
