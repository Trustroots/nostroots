import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "../useLocalStorage";

describe("useLocalStorage", () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial value when localStorage is empty", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    expect(result.current[0]).toBe("initial");
  });

  it("returns stored value from localStorage", () => {
    localStorageMock.setItem("test-key", JSON.stringify("stored value"));

    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    expect(result.current[0]).toBe("stored value");
  });

  it("updates localStorage when value changes", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("new value");
    });

    expect(result.current[0]).toBe("new value");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify("new value")
    );
  });

  it("supports function updates", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it("removes value from localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("some value");
    });

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe("initial");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("test-key");
  });

  it("handles objects", () => {
    const initialObj = { name: "test", count: 0 };
    const { result } = renderHook(() =>
      useLocalStorage("test-key", initialObj)
    );

    act(() => {
      result.current[1]({ name: "updated", count: 5 });
    });

    expect(result.current[0]).toEqual({ name: "updated", count: 5 });
  });

  it("handles arrays", () => {
    const { result } = renderHook(() =>
      useLocalStorage<string[]>("test-key", [])
    );

    act(() => {
      result.current[1](["item1", "item2"]);
    });

    expect(result.current[0]).toEqual(["item1", "item2"]);
  });

  it("returns initial value when localStorage parsing fails", () => {
    localStorageMock.getItem.mockReturnValueOnce("invalid json{");

    const { result } = renderHook(() =>
      useLocalStorage("test-key", "fallback")
    );

    expect(result.current[0]).toBe("fallback");
  });

  it("handles storage events from other windows", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "test-key",
          newValue: JSON.stringify("from another tab"),
        })
      );
    });

    expect(result.current[0]).toBe("from another tab");
  });

  it("handles storage events with null value (cleared)", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("some value");
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "test-key",
          newValue: null,
        })
      );
    });

    expect(result.current[0]).toBe("initial");
  });

  it("ignores storage events for different keys", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "other-key",
          newValue: JSON.stringify("other value"),
        })
      );
    });

    expect(result.current[0]).toBe("initial");
  });
});
