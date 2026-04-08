/**
 * @module server
 *
 * Creates and configures the Hono application with the two nr-bridge routes:
 *
 * - `POST /request_token` — start an email verification for a Trustroots user.
 * - `POST /verify_code`   — complete verification and write the npub to MongoDB.
 */
import { Hono } from "hono";
import { handleRequestToken } from "./routes/requestToken.ts";
import { handleVerifyCode } from "./routes/verifyCode.ts";

/**
 * Build a configured Hono app instance.
 *
 * @returns A Hono app with `/request_token` and `/verify_code` POST routes
 *          registered.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.post("/request_token", handleRequestToken);
  app.post("/verify_code", handleVerifyCode);

  return app;
}
