import { nip04, nip44 } from "nostr-tools";
import type { EventTemplate, VerifiedEvent } from "nostr-tools";
import { finalizeEvent, verifyEvent } from "nostr-tools/pure";

import { hexToBytes, isHexKey } from "./hex";

export function signNostrEvent(privateKeyHex: string, template: EventTemplate): VerifiedEvent {
  const event = finalizeEvent(
    {
      kind: template.kind,
      created_at: template.created_at ?? Math.floor(Date.now() / 1000),
      tags: template.tags ?? [],
      content: template.content ?? "",
    },
    hexToBytes(privateKeyHex),
  );

  if (!verifyEvent(event)) {
    throw new Error("Unable to verify signed event.");
  }

  return event;
}

export function assertPeerPubkey(peerPubkeyHex: string): void {
  if (!isHexKey(peerPubkeyHex.toLowerCase())) {
    throw new Error("Expected a 64-character peer public key.");
  }
}

export async function nip44Encrypt(privateKeyHex: string, peerPubkeyHex: string, plaintext: string): Promise<string> {
  assertPeerPubkey(peerPubkeyHex);
  const conversationKey = nip44.getConversationKey(hexToBytes(privateKeyHex), peerPubkeyHex.toLowerCase());
  return nip44.v2.encrypt(plaintext, conversationKey);
}

export async function nip44Decrypt(privateKeyHex: string, peerPubkeyHex: string, ciphertext: string): Promise<string> {
  assertPeerPubkey(peerPubkeyHex);
  const conversationKey = nip44.getConversationKey(hexToBytes(privateKeyHex), peerPubkeyHex.toLowerCase());
  return nip44.v2.decrypt(ciphertext, conversationKey);
}

export async function nip04Encrypt(privateKeyHex: string, peerPubkeyHex: string, plaintext: string): Promise<string> {
  assertPeerPubkey(peerPubkeyHex);
  return nip04.encrypt(hexToBytes(privateKeyHex), peerPubkeyHex.toLowerCase(), plaintext);
}

export async function nip04Decrypt(privateKeyHex: string, peerPubkeyHex: string, ciphertext: string): Promise<string> {
  assertPeerPubkey(peerPubkeyHex);
  return nip04.decrypt(hexToBytes(privateKeyHex), peerPubkeyHex.toLowerCase(), ciphertext);
}
