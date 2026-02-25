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

CMD ["run", "--allow-net", "--allow-env", "main.ts"]
