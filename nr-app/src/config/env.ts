import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";

function readOverride(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

// Overridden only by the Maestro e2e build, which points these at the local
// mock stack. See nr-app/.maestro/README.md.
export const TRUSTROOTS_NIP05_DOMAIN = readOverride(
  process.env.EXPO_PUBLIC_TRUSTROOTS_NIP05_DOMAIN,
  "trustroots.org",
);

export const RELAY_URL = readOverride(
  process.env.EXPO_PUBLIC_DEFAULT_RELAY_URL,
  DEFAULT_RELAY_URL,
);
