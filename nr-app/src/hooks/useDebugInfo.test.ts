import { renderHook } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { useDebugInfo } from "./useDebugInfo";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "0.0.4",
      ios: { buildNumber: "1" },
      android: { versionCode: 1 },
      extra: { commitId: "abc1234" },
    },
  },
}));

const mockApplication: {
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
} = { nativeApplicationVersion: "0.0.4", nativeBuildVersion: "27" };

jest.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return mockApplication.nativeApplicationVersion;
  },
  get nativeBuildVersion() {
    return mockApplication.nativeBuildVersion;
  },
}));

jest.mock("expo-updates", () => ({
  channel: "preview",
  updateId: "uuid-1",
  createdAt: null,
  isEmbeddedLaunch: true,
}));

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(() => undefined),
}));

describe("useDebugInfo()", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatform });
    (Updates as { channel?: string }).channel = "preview";
    (Updates as { updateId?: string }).updateId = "uuid-1";
    mockApplication.nativeBuildVersion = "27";
    mockApplication.nativeApplicationVersion = "0.0.4";
  });

  it("returns a formatted debug block for the current build", () => {
    const { result } = renderHook(() => useDebugInfo());

    expect(result.current).toContain("Nostroots debug info");
    expect(result.current).toContain("App version: 0.0.4");
    expect(result.current).toContain("Commit: abc1234");
  });

  it("marks identity as unset when there is no key or username", () => {
    const { result } = renderHook(() => useDebugInfo());

    expect(result.current).toContain("npub: not set");
    expect(result.current).toContain("Trustroots username: not set");
  });

  it("collects Android build details when OTA metadata is absent", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    (Updates as { channel?: string }).channel = undefined;
    (Updates as { updateId?: string }).updateId = undefined;

    const { result } = renderHook(() => useDebugInfo());

    expect(result.current).toContain("Update: embedded build");
  });

  it.each(["ios", "android"])(
    "reports the installed native build on %s rather than the app config",
    (os) => {
      Object.defineProperty(Platform, "OS", { value: os });

      const { result } = renderHook(() => useDebugInfo());

      expect(result.current).toContain("Build: 27");
      expect(result.current).not.toContain("Build: 1\n");
    },
  );

  it("reports the installed native app version", () => {
    mockApplication.nativeApplicationVersion = "0.0.9";

    const { result } = renderHook(() => useDebugInfo());

    expect(result.current).toContain("App version: 0.0.9");
  });

  it("falls back to the config version and an unknown build without a native binary", () => {
    mockApplication.nativeBuildVersion = null;
    mockApplication.nativeApplicationVersion = null;

    const { result } = renderHook(() => useDebugInfo());

    expect(result.current).toContain("App version: 0.0.4");
    expect(result.current).toContain("Build: unknown");
  });

  it("keeps the generated timestamp stable across re-renders", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-13T09:05:00Z"));
    const { result, rerender } = renderHook(() => useDebugInfo());
    const first = result.current;

    jest.setSystemTime(new Date("2026-07-13T09:45:00Z"));
    rerender({});

    expect(result.current).toBe(first);
    jest.useRealTimers();
  });
});
