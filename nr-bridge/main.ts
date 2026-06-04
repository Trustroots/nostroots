/**
 * @module main
 *
 * Entry point for the nr-bridge server. Uses {@link PORT} from the central
 * config module to start a Deno HTTP server with the Hono application
 * returned by {@link createApp}.
 */
import { createApp } from "./src/server.ts";
import { PORT } from "./src/config.ts";

const app = createApp();

console.log(`nr-bridge listening on port ${PORT}`);
Deno.serve({ port: PORT }, app.fetch);
