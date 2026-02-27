/**
 * @module nrBridgeUser
 *
 * Subset of the Trustroots {@link UserSchema} containing only the fields that
 * nr-bridge needs: `username`, `email`, `nostrNpub`, `created`, and `updated`.
 */
import { z } from "zod";
import { UserSchema } from "./user";

/**
 * Picks the minimal set of user fields required by nr-bridge from the full
 * Trustroots {@link UserSchema}.
 */
const NrBridgeUserSchema = UserSchema.pick({
  username: true,
  email: true,
  nostrNpub: true,
  created: true,
  updated: true,
});

export { NrBridgeUserSchema };

/** The subset of Trustroots user fields used by nr-bridge. */
export type NrBridgeUser = z.infer<typeof NrBridgeUserSchema>;
