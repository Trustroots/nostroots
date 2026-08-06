/**
 * @module server
 *
 * Creates and configures the Hono application with the nr-bridge routes:
 *
 * - `POST /verify_token` — initiates email verification for a Trustroots user.
 * - `POST /authenticate` — completes verification and writes the npub to MongoDB.
 * - `POST /support` — emails a signed support message to Trustroots support.
 */
import { Hono } from "hono";
import { handleVerifyToken } from "./routes/verifyToken.ts";
import { handleAuthenticate } from "./routes/authenticate.ts";
import { handleSupport } from "./routes/support.ts";

/**
 * Build a configured Hono app instance.
 *
 * @returns A Hono app with `/verify_token`, `/authenticate`, and `/support`
 *          POST routes registered.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.post("/verify_token", handleVerifyToken);
  app.post("/authenticate", handleAuthenticate);
  app.post("/support", handleSupport);

  return app;
}
