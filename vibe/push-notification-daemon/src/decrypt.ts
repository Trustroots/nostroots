import { nip04 } from "nostr-tools";
import type { NostrEvent } from "nostr-tools";
import { vibeSubscriptionPayloadSchema } from "./schema.ts";
import { log } from "./log.ts";

export function isEncryptedForDaemon(event: NostrEvent, daemonPubkey: string): boolean {
  const pTags = event.tags.filter((tag) => tag[0] === "p");
  return pTags.length > 0 && pTags[0][1] === daemonPubkey && event.content.includes("?iv=");
}

export async function decryptAndParseSubscription(event: NostrEvent, privateKey: string) {
  try {
    const decrypted = await nip04.decrypt(privateKey, event.pubkey, event.content);
    return vibeSubscriptionPayloadSchema.parse(JSON.parse(decrypted));
  } catch (error) {
    log.error(`Failed to decrypt/parse Vibe subscription from ${event.pubkey}:`, error);
    return undefined;
  }
}
