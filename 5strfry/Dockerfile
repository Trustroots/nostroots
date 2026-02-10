# Stage 1: compile the write-policy plugin to a standalone binary (no Deno in final image)
FROM denoland/deno:alpine AS deno-stage
WORKDIR /plugin
COPY plugin/main.ts plugin/deno.json ./
RUN deno compile -A -o nip5-policy main.ts

# Stage 2: strfry with only the compiled plugin binary
FROM thesamecat/strfry:latest
COPY --from=deno-stage /plugin/nip5-policy /app/plugin/nip5-policy
COPY plugin/run.sh /app/plugin/run.sh
RUN chmod +x /app/plugin/nip5-policy /app/plugin/run.sh
