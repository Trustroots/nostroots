import { isEventExpired, getActiveSignals } from "./signal.utils";
import { NostrEvent } from "nostr-tools";

const makeEvent = (
  overrides: Partial<NostrEvent> & { tags?: string[][] },
): NostrEvent =>
  ({
    id: "test-id",
    pubkey: "pubkey-a",
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 30397,
    content: "test",
    tags: [],
    sig: "sig",
    ...overrides,
  }) as NostrEvent;

describe("isEventExpired", () => {
  it("returns false when event has no expiration tag", () => {
    const event = makeEvent({ tags: [] });
    expect(isEventExpired(event)).toBe(false);
  });

  it("returns true when expiration is in the past", () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 100;
    const event = makeEvent({
      tags: [["expiration", pastTimestamp.toString()]],
    });
    expect(isEventExpired(event)).toBe(true);
  });

  it("returns false when expiration is in the future", () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 100000;
    const event = makeEvent({
      tags: [["expiration", futureTimestamp.toString()]],
    });
    expect(isEventExpired(event)).toBe(false);
  });
});

describe("getActiveSignals", () => {
  it("returns only events with signal tag", () => {
    const signal = makeEvent({
      pubkey: "pubkey-a",
      tags: [
        ["t", "signal"],
        ["t", "coffee"],
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const plainNote = makeEvent({
      pubkey: "pubkey-b",
      tags: [
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const result = getActiveSignals([
      { event: signal, relayUrl: "wss://relay" },
      { event: plainNote, relayUrl: "wss://relay" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].event.pubkey).toBe("pubkey-a");
  });

  it("returns only the latest signal per pubkey", () => {
    const older = makeEvent({
      pubkey: "pubkey-a",
      created_at: 1000,
      tags: [
        ["t", "signal"],
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const newer = makeEvent({
      pubkey: "pubkey-a",
      created_at: 2000,
      tags: [
        ["t", "signal"],
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const result = getActiveSignals([
      { event: older, relayUrl: "wss://relay" },
      { event: newer, relayUrl: "wss://relay" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].event.created_at).toBe(2000);
  });

  it("excludes expired signals", () => {
    const expired = makeEvent({
      pubkey: "pubkey-a",
      tags: [
        ["t", "signal"],
        ["expiration", (Math.floor(Date.now() / 1000) - 100).toString()],
      ],
    });
    const result = getActiveSignals([
      { event: expired, relayUrl: "wss://relay" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("sorts by most recent activity (latest created_at first)", () => {
    const signalA = makeEvent({
      pubkey: "pubkey-a",
      created_at: 1000,
      tags: [
        ["t", "signal"],
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const signalB = makeEvent({
      pubkey: "pubkey-b",
      created_at: 2000,
      tags: [
        ["t", "signal"],
        ["expiration", (Math.floor(Date.now() / 1000) + 100000).toString()],
      ],
    });
    const result = getActiveSignals([
      { event: signalA, relayUrl: "wss://relay" },
      { event: signalB, relayUrl: "wss://relay" },
    ]);
    expect(result[0].event.pubkey).toBe("pubkey-b");
    expect(result[1].event.pubkey).toBe("pubkey-a");
  });
});
