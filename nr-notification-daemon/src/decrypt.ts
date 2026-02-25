import { nip04 } from "npm:nostr-tools@2.10.4";
import { kind10395ContentDecryptedDecodedSchema } from "@trustroots/nr-common";
import type { Filter, NostrEvent } from "npm:nostr-tools@2.10.4";
import type { PushToken } from "./subscriptionStore.ts";

export interface DecryptedSubscription {
  readonly filters: readonly Filter[];
  readonly tokens: readonly PushToken[];
}

export function isEncryptedForDaemon(
  event: NostrEvent,
  daemonPubkey: string,
): boolean {
  const pTags = event.tags.filter((tag) => tag[0] === "p");
  if (pTags.length === 0) {
    console.log(`No p tag on event ${event.id}`);
    return false;
  }
  if (pTags[0][1] !== daemonPubkey) {
    console.log(`First p tag is not for me (was: ${pTags[0][1]})`);
    return false;
  }
  if (!event.content.includes("?iv=")) {
    console.log(`No iv marker on event ${event.id}`);
    return false;
  }
  return true;
}

export async function decryptAndParseSubscription(
  event: NostrEvent,
  privateKey: string,
): Promise<DecryptedSubscription | undefined> {
  try {
    const decrypted = await nip04.decrypt(privateKey, event.pubkey, event.content);
    const parsed = JSON.parse(decrypted);
    const validated = kind10395ContentDecryptedDecodedSchema.parse(parsed);

    const filters: readonly Filter[] = validated.filters.map((f) => f.filter);
    const tokens: readonly PushToken[] = validated.tokens.map(
      (t) => t.expoPushToken,
    );

    console.log(
      `Decrypted subscription from ${event.pubkey}: ${filters.length} filters, ${tokens.length} tokens`,
    );

    return { filters, tokens };
  } catch (error) {
    console.error(
      `Failed to decrypt/parse subscription from ${event.pubkey}:`,
      error,
    );
    return undefined;
  }
}
