import { describe, expect, it } from "vitest";

import { isKnownNip07Method } from "../../src/shared/constants";
import { failure, success } from "../../src/shared/messages";

describe("bridge message helpers", () => {
  it("recognizes only supported NIP-07 methods", () => {
    expect(isKnownNip07Method("getPublicKey")).toBe(true);
    expect(isKnownNip07Method("signEvent")).toBe(true);
    expect(isKnownNip07Method("nip44.encrypt")).toBe(true);
    expect(isKnownNip07Method("getRelays")).toBe(false);
  });

  it("formats success and error responses for the provider bridge", () => {
    expect(success("1", "ok")).toEqual({ id: "1", ok: true, result: "ok" });
    expect(failure("2", new Error("nope"))).toEqual({ id: "2", ok: false, error: "nope" });
  });
});
