import type { Context } from "hono";
import type { SlotReservation } from "../db/kv.ts";

/** Build the `429` response for a denied rate-limit reservation. */
export function rateLimited(
  c: Context,
  error: string,
  reservation: SlotReservation,
): Response {
  return c.json({ error }, 429, {
    "Retry-After": String(reservation.retryAfterSeconds),
  });
}
