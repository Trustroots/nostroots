import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-root-toast";

import { BrowserSettingsSection } from "@/browser/BrowserSettingsSection";
import { rememberOrigin } from "@/browser/permission-store";
import { ROUTES } from "@/constants/routes";

const mockUseRouter = useRouter as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  });
});

describe("BrowserSettingsSection", () => {
  it("opens the NIP-07 browser route", async () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
    });
    const { getByText } = render(<BrowserSettingsSection />);

    await waitFor(() => {
      expect(getByText("Open NIP-07 Browser")).toBeTruthy();
    });

    fireEvent.press(getByText("Open NIP-07 Browser"));

    expect(push).toHaveBeenCalledWith(ROUTES.NIP7_BROWSER);
  });

  it("opens remembered origins in the NIP-07 browser", async () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
    });
    await rememberOrigin("https://example.com", "getPublicKey");
    const { getByLabelText } = render(<BrowserSettingsSection />);

    await waitFor(() => {
      expect(getByLabelText("Open example.com in NIP-07 browser")).toBeTruthy();
    });

    fireEvent.press(getByLabelText("Open example.com in NIP-07 browser"));

    expect(push).toHaveBeenCalledWith({
      pathname: ROUTES.NIP7_BROWSER,
      params: { url: "https://example.com" },
    });
  });

  it("lists remembered origins and revokes them", async () => {
    await rememberOrigin("https://example.com", "getPublicKey");
    const { getByText, queryByText } = render(<BrowserSettingsSection />);

    await waitFor(() => {
      expect(getByText("example.com")).toBeTruthy();
    });

    fireEvent.press(getByText("Revoke"));

    await waitFor(() => {
      expect(queryByText("example.com")).toBeNull();
    });
    expect(Toast.show).toHaveBeenCalledWith(
      "Website permission revoked",
      expect.objectContaining({ duration: Toast.durations.SHORT }),
    );
  });
});
