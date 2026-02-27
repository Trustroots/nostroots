/**
 * @module server
 *
 * Creates and configures the Hono application with the two nr-bridge routes:
 *
 * - `POST /verify_token` — initiates email verification for a Trustroots user.
 * - `POST /authenticate` — completes verification and writes the npub to MongoDB.
 */
import { Hono } from "hono";
import { handleVerifyToken } from "./routes/verifyToken.ts";
import { handleAuthenticate } from "./routes/authenticate.ts";

/**
 * Build a configured Hono app instance.
 *
 * @returns A Hono app with `/verify_token` and `/authenticate` POST routes
 *          registered.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.post("/verify_token", handleVerifyToken);
  app.post("/authenticate", handleAuthenticate);

  return app;
}
