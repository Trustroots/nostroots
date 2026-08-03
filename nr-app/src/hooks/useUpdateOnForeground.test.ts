import { act, renderHook } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { AppState } from "react-native";
import Toast from "react-native-root-toast";
import { useUpdateOnForeground } from "./useUpdateOnForeground";

jest.mock("expo-updates", () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

describe("useUpdateOnForeground", () => {
  let onChange: (state: string) => Promise<void>;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        onChange = listener as (state: string) => Promise<void>;
        return { remove };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("checks only when the app becomes active", async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: false,
    });
    renderHook(() => useUpdateOnForeground());

    await act(async () => onChange("background"));
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();

    await act(async () => onChange("active"));
    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("downloads an available update and schedules a reload", async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
      isAvailable: true,
    });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue(undefined);
    (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);
    renderHook(() => useUpdateOnForeground());

    await act(async () => onChange("active"));
    expect(Toast.show).toHaveBeenNthCalledWith(1, "Downloading app update…");
    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenNthCalledWith(
      2,
      "Update downloaded, app will restart in 5 seconds.",
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it("logs update-check failures without throwing", async () => {
    const error = new Error("offline");
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(error);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    renderHook(() => useUpdateOnForeground());

    await act(async () => onChange("active"));
    expect(console.warn).toHaveBeenCalledWith("Update check failed:", error);
  });

  it("removes the app-state listener on unmount", () => {
    const { unmount } = renderHook(() => useUpdateOnForeground());
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
