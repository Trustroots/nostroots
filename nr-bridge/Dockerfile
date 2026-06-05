FROM scratch AS build-nr-common

WORKDIR /app
COPY --from=nr-common . /app/nr-common

FROM denoland/deno:2.6.6

WORKDIR /app

COPY --from=build-nr-common --chown=deno:deno /app/nr-common/ /app/nr-common/

WORKDIR /app/nr-bridge

COPY --chown=deno:deno deno.json .
COPY --chown=deno:deno deno.lock .
COPY --chown=deno:deno schemas/ schemas/
COPY --chown=deno:deno src/ src/
COPY --chown=deno:deno main.ts .

USER deno

RUN deno cache main.ts

EXPOSE 8000

CMD ["task", "run"]
