import { getPlusCodeAndPlusCodePrefixTags } from "@trustroots/nr-common";
import { publishNotePromiseAction } from "./publish.actions";

const plusCode = "9F4MGC22+22";

const templateOf = (action: ReturnType<typeof publishNotePromiseAction>) =>
  action.payload.eventTemplate;

describe("publishNotePromiseAction", () => {
  it("builds a kind 30397 note request with a d tag and plus code tags", () => {
    const before = Math.floor(Date.now() / 1000);
    const action = publishNotePromiseAction("hello", plusCode);
    const after = Math.floor(Date.now() / 1000);

    expect(action.type).toBe("publish/eventTemplate/request");
    const template = templateOf(action);
    expect(template.kind).toBe(30397);
    expect(template.content).toBe("hello");
    expect(template.created_at).toBeGreaterThanOrEqual(before);
    expect(template.created_at).toBeLessThanOrEqual(after);

    const [dTag, ...rest] = template.tags;
    expect(dTag[0]).toBe("d");
    expect(dTag[1]).toEqual(expect.any(String));
    expect(dTag[1].length).toBeGreaterThan(0);
    expect(rest).toEqual(getPlusCodeAndPlusCodePrefixTags(plusCode));
  });

  it("gives every note a fresh d tag", () => {
    const first = templateOf(publishNotePromiseAction("a", plusCode)).tags[0];
    const second = templateOf(publishNotePromiseAction("b", plusCode)).tags[0];
    expect(first[1]).not.toBe(second[1]);
  });

  it("adds a rounded expiration tag when given an expiry", () => {
    const tags = templateOf(
      publishNotePromiseAction("hello", plusCode, 1700000000.6),
    ).tags;
    expect(tags).toContainEqual(["expiration", "1700000001"]);
  });

  it("adds signal and intent topic tags after the expiration tag", () => {
    const tags = templateOf(
      publishNotePromiseAction("hello", plusCode, 1700000000, "hosting"),
    ).tags;
    expect(tags.slice(-3)).toEqual([
      ["expiration", "1700000000"],
      ["t", "signal"],
      ["t", "hosting"],
    ]);
  });

  it("leaves out expiration and topic tags when neither is given", () => {
    const tags = templateOf(
      publishNotePromiseAction("hello", plusCode, undefined, ""),
    ).tags;
    expect(tags.some(([name]) => name === "expiration" || name === "t")).toBe(
      false,
    );
  });
});
