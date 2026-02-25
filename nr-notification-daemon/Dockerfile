FROM scratch AS build-nr-common

WORKDIR /app
COPY --from=nr-common . /app/nr-common

FROM denoland/deno:2.6.6

WORKDIR /app

COPY --from=build-nr-common /app/nr-common/ /app/nr-common/

WORKDIR /app/nr-notification-daemon

USER deno

COPY deno.json .
COPY deno.lock .
COPY main.ts .
COPY src/ src/
RUN deno cache main.ts

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=60s \
  CMD deno eval "const r = await fetch('http://localhost:8081/health'); Deno.exit(r.ok ? 0 : 1)"

CMD ["run", "--allow-net", "--allow-env", "main.ts"]
