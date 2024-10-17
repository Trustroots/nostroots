import { Relay } from "nostr-tools";

const relayMap = new Map<string, Relay>();

export async function getRelay(url: string): Promise<Relay> {
  if (relayMap.has(url)) {
    const relay = relayMap.get(url)!;
    await relay.connect();
    return relay;
  }
  const relay = new Relay(url);
  relayMap.set(url, relay);
  await relay.connect();
  return relay;
}

export function getAllRelays(): Relay[] {
  const relays = Array.from(relayMap.values());
  return relays;
}
