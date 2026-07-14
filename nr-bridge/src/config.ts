/**
 * @module config
 *
 * Single source of truth for all runtime configuration. Each environment
 * variable is read exactly once, at module load. Required values throw
 * immediately if unset; optional values fall back to a default.
 *
 * Other modules should import named values from here rather than calling
 * `Deno.env.get` directly.
 */

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return Deno.env.get(name) ?? defaultValue;
}

/** MongoDB connection URI used by the bridge. */
export const MONGODB_URI = optional(
  "MONGODB_URI",
  "mongodb://mongodb:27017/trustroots-dev",
);

/** Database name parsed from {@link MONGODB_URI}. */
export const MONGODB_DB_NAME = new URL(MONGODB_URI).pathname.slice(1) ||
  "trustroots-dev";

/** HTTP server port. */
export const PORT = Number(optional("PORT", "8000"));

/** SMTP server hostname. */
export const SMTP_HOST = required("SMTP_HOST");

/** SMTP server port. */
export const SMTP_PORT = Number(optional("SMTP_PORT", "587"));

/** SMTP username. */
export const SMTP_USER = optional("SMTP_USER", "");

/** SMTP password. */
export const SMTP_PASS = optional("SMTP_PASS", "");

/** Sender address used for verification emails. */
export const SMTP_FROM = optional("SMTP_FROM", "support@trustroots.org");

/**
 * Path passed to {@link Deno.openKv}. Required so we never accidentally start
 * the server without a persistent KV store. Set to `:memory:` in tests; set
 * to a real filesystem path in production.
 */
export const DENO_KV_PATH = required("DENO_KV_PATH");

/**
 * Base URL for the iOS deep link (e.g. `nostroots://verify`).
 * When unset the deep-link button is omitted from verification emails.
 */
export const DEEP_LINK_BASE: string | undefined = Deno.env.get("DEEP_LINK_BASE");
