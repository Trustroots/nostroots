import { VerifiedEvent } from "nostr-tools";
import { getRelay } from "./relays.nostr";

export async function publishVerifiedEventToRelay(
  event: VerifiedEvent,
  relayUrl: string,
) {
  const relay = await getRelay(relayUrl);
  const result = await relay.publish(event);
  return result;
}
