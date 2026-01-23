import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatNumber,
  formatDate,
  formatRelativeTime,
  truncate,
  capitalize,
  toTitleCase,
} from "../format";

describe("format utilities", () => {
  describe("formatNumber", () => {
    it("formats integers with thousand separators", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    it("formats negative numbers", () => {
      expect(formatNumber(-1000)).toBe("-1,000");
    });

    it("formats decimal numbers", () => {
      expect(formatNumber(1234.56)).toBe("1,234.56");
    });

    it("handles zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("respects locale", () => {
      expect(formatNumber(1000, "de-DE")).toBe("1.000");
    });
  });

  describe("formatDate", () => {
    it("formats a Date object", () => {
      const date = new Date("2024-01-15");
      expect(formatDate(date)).toBe("January 15, 2024");
    });

    it("formats a date string", () => {
      expect(formatDate("2024-01-15")).toBe("January 15, 2024");
    });

    it("formats a timestamp", () => {
      const timestamp = new Date("2024-01-15").getTime();
      expect(formatDate(timestamp)).toBe("January 15, 2024");
    });

    it("respects custom options", () => {
      const date = new Date("2024-01-15");
      expect(
        formatDate(date, { month: "short", day: "numeric", year: "2-digit" })
      ).toBe("Jan 15, 24");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("formats seconds ago", () => {
      const date = new Date("2024-01-15T11:59:30Z"); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe("30 seconds ago");
    });

    it("formats minutes ago", () => {
      const date = new Date("2024-01-15T11:55:00Z"); // 5 minutes ago
      expect(formatRelativeTime(date)).toBe("5 minutes ago");
    });

    it("formats hours ago", () => {
      const date = new Date("2024-01-15T09:00:00Z"); // 3 hours ago
      expect(formatRelativeTime(date)).toBe("3 hours ago");
    });

    it("formats days ago", () => {
      const date = new Date("2024-01-13T12:00:00Z"); // 2 days ago
      expect(formatRelativeTime(date)).toBe("2 days ago");
    });

    it("formats weeks ago", () => {
      const date = new Date("2024-01-01T12:00:00Z"); // 2 weeks ago
      expect(formatRelativeTime(date)).toBe("2 weeks ago");
    });

    it('formats "just now" for current time', () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(formatRelativeTime(date)).toBe("now");
    });
  });

  describe("truncate", () => {
    it("returns original string if shorter than max length", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates string with ellipsis", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
    });

    it("uses custom suffix", () => {
      expect(truncate("hello world", 8, "…")).toBe("hello w…");
    });

    it("handles exact length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("handles empty string", () => {
      expect(truncate("", 5)).toBe("");
    });
  });

  describe("capitalize", () => {
    it("capitalizes first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
    });

    it("handles already capitalized strings", () => {
      expect(capitalize("Hello")).toBe("Hello");
    });

    it("handles single character", () => {
      expect(capitalize("h")).toBe("H");
    });

    it("handles empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("handles strings starting with numbers", () => {
      expect(capitalize("123abc")).toBe("123abc");
    });
  });

  describe("toTitleCase", () => {
    it("converts to title case", () => {
      expect(toTitleCase("hello world")).toBe("Hello World");
    });

    it("handles all caps", () => {
      expect(toTitleCase("HELLO WORLD")).toBe("Hello World");
    });

    it("handles mixed case", () => {
      expect(toTitleCase("hELLO wORLD")).toBe("Hello World");
    });

    it("handles single word", () => {
      expect(toTitleCase("hello")).toBe("Hello");
    });

    it("handles empty string", () => {
      expect(toTitleCase("")).toBe("");
    });
  });
});
