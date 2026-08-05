import { renderHook } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { useDebugInfo } from "./useDebugInfo";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "0.0.4",
      ios: { buildNumber: "27" },
      extra: { commitId: "abc1234" },
    },
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

    expect(result.current).toContain("Build: unknown");
    expect(result.current).toContain("Update: embedded build");
  });
});
