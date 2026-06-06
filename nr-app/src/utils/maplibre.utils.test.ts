import { EventWithMetadata } from "@/redux/slices/events.slice";
import { NostrProfile } from "@/redux/slices/profiles.slice";
import {
  debounce,
  eventsToGeoJSON,
  getIntentFromEvent,
  truncatePlusCode,
  zoomToPlusCodeLength,
} from "./maplibre.utils";

// ---------------------------------------------------------------------------
// Helpers to build test fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides: {
  id?: string;
  pubkey?: string;
  content?: string;
  plusCode?: string;
  intentKey?: string;
  created_at?: number;
}): EventWithMetadata {
  const {
    id = "abc123",
    pubkey = "pubkey1",
    content = "Hello world",
    plusCode = "8FVC2222+22",
    intentKey,
    created_at = 1700000000,
  } = overrides;

  const tags: string[][] = [
    ["L", "open-location-code"],
    ["l", plusCode, "open-location-code"],
    ["L", "open-location-code-prefix"],
    ["l", "8F000000+", "8FVC0000+", "open-location-code-prefix"],
  ];

  if (intentKey) {
    tags.push(["t", "signal"]);
    tags.push(["t", intentKey]);
  }

  return {
    event: {
      id,
      pubkey,
      kind: 30398,
      content,
      created_at,
      sig: "sig",
      tags,
    },
    metadata: { seenOnRelays: ["wss://relay.example.com"] },
  };
}

function makeProfile(overrides: Partial<NostrProfile> = {}): NostrProfile {
  return {
    pubkey: "pubkey1",
    name: "Alice",
    picture: "https://example.com/avatar.jpg",
    fetchedAt: 1700000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: zoomToPlusCodeLength
// ---------------------------------------------------------------------------

describe("zoomToPlusCodeLength", () => {
  it("returns 2 for zoom 0–3", () => {
    expect(zoomToPlusCodeLength(0)).toBe(2);
    expect(zoomToPlusCodeLength(3)).toBe(2);
  });

  it("returns 4 for zoom 4–6", () => {
    expect(zoomToPlusCodeLength(4)).toBe(4);
    expect(zoomToPlusCodeLength(6)).toBe(4);
  });

  it("returns 6 for zoom 7–9", () => {
    expect(zoomToPlusCodeLength(7)).toBe(6);
    expect(zoomToPlusCodeLength(9)).toBe(6);
  });

  it("returns 8 for zoom 10–12", () => {
    expect(zoomToPlusCodeLength(10)).toBe(8);
    expect(zoomToPlusCodeLength(12)).toBe(8);
  });

  it("returns 10 for zoom 13+", () => {
    expect(zoomToPlusCodeLength(13)).toBe(10);
    expect(zoomToPlusCodeLength(18)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Tests: truncatePlusCode
// ---------------------------------------------------------------------------

describe("truncatePlusCode", () => {
  it("truncates to 2-char precision", () => {
    expect(truncatePlusCode("8FVC2222+22", 2)).toBe("8F000000+");
  });

  it("truncates to 4-char precision", () => {
    expect(truncatePlusCode("8FVC2222+22", 4)).toBe("8FVC0000+");
  });

  it("truncates to 6-char precision", () => {
    expect(truncatePlusCode("8FVC2222+22", 6)).toBe("8FVC2200+");
  });

  it("truncates to 8-char precision (full code)", () => {
    expect(truncatePlusCode("8FVC2222+22", 8)).toBe("8FVC2222+");
  });
});

// ---------------------------------------------------------------------------
// Tests: getIntentFromEvent
// ---------------------------------------------------------------------------

describe("getIntentFromEvent", () => {
  it("returns undefined when no intent tag is present", () => {
    const tags = [
      ["L", "open-location-code"],
      ["l", "8FVC2222+22", "open-location-code"],
    ];
    expect(getIntentFromEvent(tags)).toBeUndefined();
  });

  it("returns undefined when only the bare signal tag is present", () => {
    const tags = [["t", "signal"]];
    expect(getIntentFromEvent(tags)).toBeUndefined();
  });

  it("returns emoji and label for a known intent", () => {
    const tags = [
      ["t", "signal"],
      ["t", "coffee"],
    ];
    expect(getIntentFromEvent(tags)).toEqual({
      emoji: "☕",
      label: "Coffee",
    });
  });

  it("returns undefined for an unknown intent key", () => {
    const tags = [
      ["t", "signal"],
      ["t", "skydiving"],
    ];
    expect(getIntentFromEvent(tags)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: eventsToGeoJSON (grouped by plus code with precision)
// ---------------------------------------------------------------------------

describe("eventsToGeoJSON", () => {
  it("returns an empty FeatureCollection when given no events", () => {
    const result = eventsToGeoJSON([], {});
    expect(result).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("groups events with same plus code into one feature at full precision", () => {
    const events = [
      makeEvent({ id: "e1", pubkey: "p1", created_at: 1700000001 }),
      makeEvent({ id: "e2", pubkey: "p2", created_at: 1700000002 }),
    ];
    const result = eventsToGeoJSON(events, {}, 8);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.count).toBe(2);
  });

  it("merges events from different precise codes into one group at low precision", () => {
    const events = [
      makeEvent({ id: "e1", plusCode: "8FVC2222+22" }),
      makeEvent({ id: "e2", plusCode: "8FVC3333+33" }),
    ];
    // At 4-char precision, both truncate to "8FVC0000+"
    const result = eventsToGeoJSON(events, {}, 4);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.count).toBe(2);
    expect(result.features[0].properties.plusCode).toBe("8FVC0000+");
  });

  it("keeps events in different regions as separate features at low precision", () => {
    const events = [
      makeEvent({ id: "e1", plusCode: "8FVC2222+22" }),
      makeEvent({ id: "e2", plusCode: "9C3W2222+22" }),
    ];
    const result = eventsToGeoJSON(events, {}, 4);

    expect(result.features).toHaveLength(2);
  });

  it("uses most recent event for metadata", () => {
    const events = [
      makeEvent({ id: "e1", pubkey: "p1", created_at: 1700000001, intentKey: "coffee" }),
      makeEvent({ id: "e2", pubkey: "p2", created_at: 1700000002, intentKey: "hosting" }),
    ];
    const profiles = {
      p2: makeProfile({ pubkey: "p2", name: "Bob", picture: "https://bob.jpg" }),
    };
    const result = eventsToGeoJSON(events, profiles, 8);

    expect(result.features[0].properties.intentLabel).toBe("Hosting");
    expect(result.features[0].properties.displayName).toBe("Bob");
  });

  it("places the point at the truncated plus code center", () => {
    const event = makeEvent({});
    const result = eventsToGeoJSON([event], {}, 8);

    expect(result.features[0].geometry.type).toBe("Point");
    expect(result.features[0].geometry.coordinates).toHaveLength(2);
    expect(typeof result.features[0].geometry.coordinates[0]).toBe("number");
  });

  it("skips events without a plus code label", () => {
    const event: EventWithMetadata = {
      event: {
        id: "no-plus-code",
        pubkey: "pubkey1",
        kind: 30398,
        content: "No location",
        created_at: 1700000000,
        sig: "sig",
        tags: [],
      },
      metadata: { seenOnRelays: [] },
    };
    const result = eventsToGeoJSON([event], {});
    expect(result.features).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: debounce
// ---------------------------------------------------------------------------

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("delays invocation by the specified time", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on repeated calls", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    jest.advanceTimersByTime(300);
    debounced(); // reset
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls the function with the latest arguments", () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced("first");
    debounced("second");
    jest.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledWith("second");
  });
});
