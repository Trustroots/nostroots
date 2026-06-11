import { fireEvent, render, screen } from "@testing-library/react-native";
import { Redirect, useRouter } from "expo-router";

import Nip7BrowserRoute from "./browser";
import { ROUTES } from "@/constants/routes";
import { useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

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
