import { NostrEvent } from "nostr-tools";
import {
  countUpcomingGatherings,
  formatGatheringDateTime,
  getGatheringEnd,
  getGatheringStart,
  getGatheringTitle,
  getLocalTimezoneAbbr,
  isGatheringEvent,
  hasGatheringEnded,
} from "./event-gathering.utils";

const NOW = new Date("2026-06-02T12:00:00Z");
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function makeEvent(tags: string[][], kind = 31923): NostrEvent {
  return {
    id: "id",
    pubkey: "pubkey",
    created_at: unix("2026-06-01T00:00:00Z"),
    kind,
    tags,
    content: "",
    sig: "sig",
  };
}

function gathering(tags: string[][], kind = 31923): NostrEvent {
  return makeEvent([["d", "id-1"], ["title", "Potluck"], ...tags], kind);
}

describe("isGatheringEvent", () => {
  it("recognises a calendar event with identifier, title and start", () => {
    expect(isGatheringEvent(gathering([["start", "1780000000"]]))).toBe(true);
  });

  it("recognises a gathering with a later end", () => {
    expect(
      isGatheringEvent(
        gathering([
          ["start", "1780000000"],
          ["end", "1780003600"],
        ]),
      ),
    ).toBe(true);
  });

  it("accepts an empty description, as NIP-52 permits", () => {
    expect(isGatheringEvent(gathering([["start", "1780000000"]]))).toBe(true);
    expect(gathering([["start", "1780000000"]]).content).toBe("");
  });

  it.each([
    [
      "missing identifier",
      [
        ["title", "T"],
        ["start", "1780000000"],
      ],
    ],
    [
      "empty identifier",
      [
        ["d", ""],
        ["title", "T"],
        ["start", "1780000000"],
      ],
    ],
    [
      "missing title",
      [
        ["d", "x"],
        ["start", "1780000000"],
      ],
    ],
    [
      "blank title",
      [
        ["d", "x"],
        ["title", "  "],
        ["start", "1780000000"],
      ],
    ],
    [
      "empty start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", ""],
      ],
    ],
    [
      "non-numeric start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "soon"],
      ],
    ],
    [
      "trailing junk",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "1780000000junk"],
      ],
    ],
    [
      "fractional start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "1780000000.5"],
      ],
    ],
    [
      "negative start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "-5"],
      ],
    ],
    [
      "out-of-range start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "99999999999999"],
      ],
    ],
    [
      "non-numeric end",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "1780000000"],
        ["end", "later"],
      ],
    ],
    [
      "end equal to start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "1780000000"],
        ["end", "1780000000"],
      ],
    ],
    [
      "end before start",
      [
        ["d", "x"],
        ["title", "T"],
        ["start", "1780000000"],
        ["end", "1779999999"],
      ],
    ],
  ])("rejects a calendar event with %s", (_name, tags) => {
    expect(isGatheringEvent(makeEvent(tags as string[][]))).toBe(false);
  });

  it("rejects a map note with a start tag", () => {
    expect(isGatheringEvent(makeEvent([["start", "1780000000"]], 30397))).toBe(
      false,
    );
  });

  it("rejects an event without a start tag", () => {
    expect(isGatheringEvent(makeEvent([["title", "Potluck"]]))).toBe(false);
  });

  it("rejects a start tag with no value", () => {
    expect(isGatheringEvent(makeEvent([["start"]]))).toBe(false);
  });

  it("rejects an event with no tags", () => {
    expect(isGatheringEvent(makeEvent([]))).toBe(false);
  });
});

describe("getGatheringTitle", () => {
  it("returns the title tag value", () => {
    expect(getGatheringTitle(makeEvent([["title", "Potluck"]]))).toBe(
      "Potluck",
    );
  });

  it("returns undefined when there is no title tag", () => {
    expect(getGatheringTitle(makeEvent([["start", "1"]]))).toBeUndefined();
  });
});

describe("getGatheringStart", () => {
  it("parses the start tag as a number", () => {
    expect(getGatheringStart(makeEvent([["start", "1780000000"]]))).toBe(
      1780000000,
    );
  });

  it("returns undefined when there is no start tag", () => {
    expect(getGatheringStart(makeEvent([]))).toBeUndefined();
  });

  it("returns undefined for a non-numeric start tag", () => {
    expect(getGatheringStart(makeEvent([["start", "soon"]]))).toBeUndefined();
  });

  it("returns undefined for a start tag with trailing junk", () => {
    expect(
      getGatheringStart(makeEvent([["start", "1780000000junk"]])),
    ).toBeUndefined();
  });
});

describe("getGatheringEnd", () => {
  it("parses the end tag as a number", () => {
    expect(getGatheringEnd(makeEvent([["end", "1780003600"]]))).toBe(
      1780003600,
    );
  });

  it("returns undefined when there is no end tag", () => {
    expect(getGatheringEnd(makeEvent([["start", "1"]]))).toBeUndefined();
  });

  it("returns undefined for a non-numeric end tag", () => {
    expect(getGatheringEnd(makeEvent([["end", "later"]]))).toBeUndefined();
  });
});

describe("formatGatheringDateTime", () => {
  it("formats a timestamp with month, day and time", () => {
    const formatted = formatGatheringDateTime(unix("2026-06-15T15:00:00Z"));
    expect(formatted).toMatch(/Jun/);
    expect(formatted).toMatch(/15/);
  });
});

describe("getLocalTimezoneAbbr", () => {
  let spy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    spy = jest.spyOn(Date.prototype, "getTimezoneOffset");
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("returns UTC at zero offset", () => {
    spy.mockReturnValue(0);
    expect(getLocalTimezoneAbbr()).toBe("UTC");
  });

  it("returns a positive offset for timezones ahead of UTC", () => {
    spy.mockReturnValue(-120);
    expect(getLocalTimezoneAbbr()).toBe("UTC+2");
  });

  it("returns a negative offset for timezones behind UTC", () => {
    spy.mockReturnValue(300);
    expect(getLocalTimezoneAbbr()).toBe("UTC-5");
  });

  it("includes minutes for half-hour offsets", () => {
    spy.mockReturnValue(-330);
    expect(getLocalTimezoneAbbr()).toBe("UTC+5:30");
  });
});

describe("countUpcomingGatherings", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 0 for an empty list", () => {
    expect(countUpcomingGatherings([])).toBe(0);
  });

  it("counts gatherings starting in the future", () => {
    const events = [
      gathering([["start", String(unix("2026-06-03T12:00:00Z"))]]),
      gathering([["start", String(unix("2026-06-10T12:00:00Z"))]]),
    ];
    expect(countUpcomingGatherings(events)).toBe(2);
  });

  it("ignores gatherings that already started and have no end", () => {
    const events = [
      gathering([["start", String(unix("2026-06-01T12:00:00Z"))]]),
    ];
    expect(countUpcomingGatherings(events)).toBe(0);
  });

  it("counts an in-progress gathering whose end is still in the future", () => {
    const events = [
      gathering([
        ["start", String(unix("2026-06-02T10:00:00Z"))],
        ["end", String(unix("2026-06-02T18:00:00Z"))],
      ]),
    ];
    expect(countUpcomingGatherings(events)).toBe(1);
  });

  it("ignores a gathering that has already ended", () => {
    const events = [
      makeEvent([
        ["start", String(unix("2026-06-01T10:00:00Z"))],
        ["end", String(unix("2026-06-01T18:00:00Z"))],
      ]),
    ];
    expect(countUpcomingGatherings(events)).toBe(0);
  });

  it("ignores non-gathering events", () => {
    const events = [
      makeEvent([["title", "Just a note"]]),
      gathering([["start", String(unix("2026-06-10T12:00:00Z"))]]),
    ];
    expect(countUpcomingGatherings(events)).toBe(1);
  });
});

describe("hasGatheringEnded", () => {
  const now = unix("2026-06-02T12:00:00Z");

  it("treats a started gathering with a future end as not ended", () => {
    const event = gathering([
      ["start", String(unix("2026-06-02T10:00:00Z"))],
      ["end", String(unix("2026-06-02T18:00:00Z"))],
    ]);
    expect(hasGatheringEnded(event, now)).toBe(false);
  });

  it("treats a gathering with a past end as ended", () => {
    const event = gathering([
      ["start", String(unix("2026-06-01T10:00:00Z"))],
      ["end", String(unix("2026-06-01T18:00:00Z"))],
    ]);
    expect(hasGatheringEnded(event, now)).toBe(true);
  });

  it("uses the start when there is no end", () => {
    expect(
      hasGatheringEnded(
        gathering([["start", String(unix("2026-06-03T10:00:00Z"))]]),
        now,
      ),
    ).toBe(false);
    expect(
      hasGatheringEnded(
        gathering([["start", String(unix("2026-06-01T10:00:00Z"))]]),
        now,
      ),
    ).toBe(true);
  });
});
