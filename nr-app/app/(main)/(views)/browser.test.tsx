import { fireEvent, render, screen } from "@testing-library/react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import Nip7BrowserRoute from "./browser";
import { NOSTROOTS_WEB_URL } from "@/constants";
import { ROUTES } from "@/constants/routes";
import { useAppSelector } from "@/redux/hooks";

import { BrowserScreen } from "@/browser/BrowserScreen";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
}));

jest.mock("@/browser/BrowserScreen", () => ({
  BrowserScreen: jest.fn(() => null),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockBrowserScreen = BrowserScreen as jest.Mock;

function fakeState(
  areTestFeaturesEnabled: boolean,
  hasPrivateKeyHexInSecureStorage = true,
  isKeystoreLoaded = true,
) {
  return {
    settings: {
      areTestFeaturesEnabled,
    },
    keystore: {
      hasPrivateKeyHexInSecureStorage,
      isLoaded: isKeystoreLoaded,
    },
  };
}

describe("Nip7BrowserRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    });
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it("redirects away when Developer Mode is off", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false)),
    );
    render(<Nip7BrowserRoute />);

    expect(Redirect).toHaveBeenCalledWith({ href: "/(main)/(map)" }, undefined);
  });

  it("shows a loading state until the keystore is hydrated", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true, true, false)),
    );
    render(<Nip7BrowserRoute />);

    expect(screen.UNSAFE_getByType("ActivityIndicator")).toBeTruthy();
  });

  it("passes a validated url param to BrowserScreen", () => {
    mockUseLocalSearchParams.mockReturnValue({
      url: "https://example.com/page",
    });
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true)),
    );
    render(<Nip7BrowserRoute />);

    expect(mockBrowserScreen).toHaveBeenCalledWith(
      { initialUrl: "https://example.com" },
      undefined,
    );
  });

  it("falls back to Nostroots web for invalid url params", () => {
    mockUseLocalSearchParams.mockReturnValue({ url: "not-a-url" });
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true)),
    );
    render(<Nip7BrowserRoute />);

    expect(mockBrowserScreen).toHaveBeenCalledWith(
      { initialUrl: NOSTROOTS_WEB_URL },
      undefined,
    );
  });

  it("prompts for a key and opens Settings with push when no key is loaded", () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
    });
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true, false)),
    );
    const { getByText } = render(<Nip7BrowserRoute />);

    expect(getByText("No Nostr key available")).toBeTruthy();
    fireEvent.press(getByText("Open Settings"));
    expect(push).toHaveBeenCalledWith(ROUTES.SETTINGS);
  });
});
