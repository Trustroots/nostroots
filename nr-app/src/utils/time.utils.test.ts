import { countNotesToday, getNoteSummaryText } from "./time.utils";

describe("countNotesToday", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-02T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts notes from today", () => {
    const timestamps = [
      Math.floor(new Date("2026-06-02T10:00:00Z").getTime() / 1000),
      Math.floor(new Date("2026-06-02T01:00:00Z").getTime() / 1000),
      Math.floor(new Date("2026-06-01T23:00:00Z").getTime() / 1000),
      Math.floor(new Date("2026-05-30T12:00:00Z").getTime() / 1000),
    ];
    expect(countNotesToday(timestamps)).toBe(2);
  });

  it("returns 0 when no notes are from today", () => {
    const timestamps = [
      Math.floor(new Date("2026-06-01T12:00:00Z").getTime() / 1000),
    ];
    expect(countNotesToday(timestamps)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(countNotesToday([])).toBe(0);
  });
});

describe("getNoteSummaryText", () => {
  it("returns empty state text for 0 notes", () => {
    expect(getNoteSummaryText(0, 0)).toBe("No notes yet");
  });

  it("returns count with today for recent activity", () => {
    expect(getNoteSummaryText(3, 1)).toBe("3 notes \u00b7 1 today");
  });

  it("returns count without today when none are from today", () => {
    expect(getNoteSummaryText(5, 0)).toBe("5 notes");
  });

  it("uses singular for 1 note", () => {
    expect(getNoteSummaryText(1, 1)).toBe("1 note \u00b7 1 today");
  });
});
