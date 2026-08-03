import {
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";

import {
  getKindName,
  getPlusCodeFromEvent,
  isEventForPlusCodeExactly,
  isEventWithinThisPlusCode,
} from "./event.utils";

function eventWithPlusCode(plusCode?: string) {
  return {
    content: "",
    created_at: 1,
    id: "0".repeat(64),
    kind: MAP_NOTE_REPOST_KIND,
    pubkey: "1".repeat(64),
    sig: "2".repeat(128),
    tags: plusCode
      ? [
          ["L", OPEN_LOCATION_CODE_LABEL_NAMESPACE],
          ["l", plusCode, OPEN_LOCATION_CODE_LABEL_NAMESPACE],
        ]
      : [],
  };
}

describe("event.utils", () => {
  it("extracts plus codes from labeled events", () => {
    expect(getPlusCodeFromEvent(eventWithPlusCode("9F4G0000+"))).toBe(
      "9F4G0000+",
    );
  });

  it("detects exact plus-code matches", () => {
    expect(
      isEventForPlusCodeExactly(eventWithPlusCode("9F4G0000+"), "9F4G0000+"),
    ).toBe(true);
  });

  it("detects child events within a parent plus code", () => {
    expect(
      isEventWithinThisPlusCode(eventWithPlusCode("9F4G9Q00+"), "9F4G0000+"),
    ).toBe(true);
    expect(isEventWithinThisPlusCode(eventWithPlusCode(), "9F4G0000+")).toBe(
      false,
    );
  });

  it.each([
    [TRUSTROOTS_PROFILE_KIND, "Trustroots Profile"],
    [NOTIFICATION_SUBSCRIPTION_KIND, "Notification Subscription"],
    [MAP_NOTE_KIND, "Map Note"],
    [MAP_NOTE_REPOST_KIND, "Map Note Repost"],
    [123, "Unknown Kind (123)"],
  ])("names kind %s", (kind, name) => {
    expect(getKindName(kind)).toBe(name);
  });
});
