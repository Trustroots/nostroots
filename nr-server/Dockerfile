FROM scratch AS build-nr-common

WORKDIR /app
COPY --from=nr-common . /app/nr-common

FROM denoland/deno:2.1.1

WORKDIR /app

COPY --from=build-nr-common /app/nr-common/ /app/nr-common/

WORKDIR /app/nr-server

# Prefer not to run as root.
USER deno

COPY deno.jsonc .
COPY deno.lock .
# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY deps.ts .
RUN deno cache deps.ts

# These steps will be re-run upon each file change in your working directory:
COPY . .

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD deno eval "const r = await fetch('http://localhost:80/health'); Deno.exit(r.ok ? 0 : 1)"

CMD ["task", "run"]