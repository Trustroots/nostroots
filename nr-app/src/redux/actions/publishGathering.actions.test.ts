import {
  CONTENT_MAXIMUM_LENGTH,
  kind30397EventSchema,
} from "@trustroots/nr-common";
import { publishGatheringPromiseAction } from "./publishGathering.actions";

function makeAction(description: string) {
  return publishGatheringPromiseAction({
    title: "Community potluck",
    description,
    plusCode: "8FVC2222+22",
    startTimestamp: 1_780_003_600,
  });
}

function finalizeTemplate(description: string) {
  return {
    ...makeAction(description).payload.eventTemplate,
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    sig: "signature",
  };
}

describe("publishGatheringPromiseAction", () => {
  it.each(["", "a", "ab", "valid description"])(
    "creates a schema-valid gathering for description %j",
    (description) => {
      expect(
        kind30397EventSchema.safeParse(finalizeTemplate(description)).success,
      ).toBe(true);
    },
  );

  it("accepts a description at the maximum length", () => {
    expect(
      kind30397EventSchema.safeParse(
        finalizeTemplate("a".repeat(CONTENT_MAXIMUM_LENGTH)),
      ).success,
    ).toBe(true);
  });

  it("rejects a description above the maximum length", () => {
    expect(() => makeAction("a".repeat(CONTENT_MAXIMUM_LENGTH + 1))).toThrow(
      `Description must be at most ${CONTENT_MAXIMUM_LENGTH} characters`,
    );
  });
});
