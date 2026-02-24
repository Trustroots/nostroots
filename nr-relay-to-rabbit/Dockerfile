FROM scratch AS build-nr-common

WORKDIR /app
COPY --from=nr-common . /app/nr-common

FROM denoland/deno:2.1.1

WORKDIR /app

COPY --from=build-nr-common /app/nr-common/ /app/nr-common/

WORKDIR /app/nr-relay-to-rabbit

USER deno

COPY deno.json .
COPY deno.lock .
COPY main.ts .
COPY src/ src/
RUN deno cache main.ts

EXPOSE 80

CMD ["run", "--allow-net", "--allow-env", "main.ts"]
