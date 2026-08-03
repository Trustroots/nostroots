import { getSerializableError } from "./error.utils";

describe("error.utils", () => {
  it("serializes Error instances with optional code and data", () => {
    const error = Object.assign(new Error("Boom"), {
      code: "ERR_TEST",
      data: { detail: true },
    });

    expect(getSerializableError(error)).toEqual({
      code: "ERR_TEST",
      data: { detail: true },
      message: "Boom",
      name: "ERR_TEST",
    });
  });

  it("returns a fallback for non-error values", () => {
    expect(getSerializableError("nope")).toEqual({
      message: "getSerializableError called on non error",
      name: "7VYE53-invalid-error",
    });
  });
});
