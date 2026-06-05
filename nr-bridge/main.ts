/**
 * @module main
 *
 * Entry point for the nr-bridge server. Reads the `PORT` environment variable
 * (default `8000`) and starts a Deno HTTP server using the Hono application
 * returned by {@link createApp}.
 */
import { createApp } from "./src/server.ts";

const port = Number(Deno.env.get("PORT") ?? "8000");
const app = createApp();

console.log(`nr-bridge listening on port ${port}`);
Deno.serve({ port }, app.fetch);
