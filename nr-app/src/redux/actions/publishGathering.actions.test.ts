import {
  CALENDAR_TIME_EVENT_KIND,
  CONTENT_MAXIMUM_LENGTH,
  CONTENT_MINIMUM_LENGTH,
  getPlusCodeAndPlusCodePrefixTags,
} from "@trustroots/nr-common";
import { getGeohashTagsForPlusCode } from "@/utils/geohash.utils";
import { publishGatheringPromiseAction } from "./publishGathering.actions";

const PLUS_CODE = "8FVC2222+";
const START = 1_780_003_600;

function makeAction(description: string, endTimestamp?: number) {
  return publishGatheringPromiseAction({
    title: "Community potluck",
    description,
    plusCode: PLUS_CODE,
    startTimestamp: START,
    endTimestamp,
  });
}

function tagsOf(action: ReturnType<typeof makeAction>) {
  return action.payload.eventTemplate.tags;
}

describe("publishGatheringPromiseAction", () => {
  it("publishes a NIP-52 time-based calendar event", () => {
    const { eventTemplate } = makeAction("Bring a dish").payload;

    expect(eventTemplate.kind).toBe(CALENDAR_TIME_EVENT_KIND);
    expect(eventTemplate.content).toBe("Bring a dish");
    expect(eventTemplate.tags).toEqual(
      expect.arrayContaining([
        ["d", expect.any(String)],
        ["title", "Community potluck"],
        ["start", START.toString()],
        ["start_tzid", expect.any(String)],
      ]),
    );
  });

  it("tags the location with cascading geohashes and the plus code labels", () => {
    const tags = tagsOf(makeAction("Bring a dish"));

    expect(tags).toEqual(
      expect.arrayContaining([
        ...getGeohashTagsForPlusCode(PLUS_CODE),
        ...getPlusCodeAndPlusCodePrefixTags(PLUS_CODE),
      ]),
    );
  });

  it("expires a day after the start when there is no end", () => {
    expect(tagsOf(makeAction("Bring a dish"))).toContainEqual([
      "expiration",
      (START + 24 * 60 * 60).toString(),
    ]);
  });

  it("includes the end and expires at the end when given", () => {
    const end = START + 3 * 60 * 60;
    const tags = tagsOf(makeAction("Bring a dish", end));

    expect(tags).toContainEqual(["end", end.toString()]);
    expect(tags).toContainEqual(["expiration", end.toString()]);
  });

  it("accepts a description at the maximum length", () => {
    expect(() => makeAction("a".repeat(CONTENT_MAXIMUM_LENGTH))).not.toThrow();
  });

  it.each(["", "a", "ab"])(
    "rejects a description below the minimum length %j",
    (description) => {
      expect(() => makeAction(description)).toThrow(
        `Description must be at least ${CONTENT_MINIMUM_LENGTH} characters`,
      );
    },
  );

  it("rejects a description above the maximum length", () => {
    expect(() => makeAction("a".repeat(CONTENT_MAXIMUM_LENGTH + 1))).toThrow(
      `Description must be at most ${CONTENT_MAXIMUM_LENGTH} characters`,
    );
  });
});
