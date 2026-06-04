import { getRelativeTime } from "./time.utils";

describe("time.utils", () => {
  const nowSeconds = 1_700_000_000;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [nowSeconds - 30, "just now"],
    [nowSeconds - 5 * 60, "5m ago"],
    [nowSeconds - 2 * 3600, "2h ago"],
    [nowSeconds - 3 * 86400, "3d ago"],
  ])("formats relative time for %s", (timestamp, output) => {
    expect(getRelativeTime(timestamp)).toBe(output);
  });

  it("formats older dates as locale dates", () => {
    expect(getRelativeTime(nowSeconds - 8 * 86400)).toMatch(/\d/);
  });
});
