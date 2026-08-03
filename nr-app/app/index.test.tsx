import { render } from "@testing-library/react-native";

import IndexRoute from "./index";
import { settingsActions } from "@/redux/slices/settings.slice";

import { useAppSelector } from "@/redux/hooks";

const mockDispatch = jest.fn();

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => `redirect:${href}`,
}));

jest.mock("@trustroots/nr-common", () => ({
  getNip5PubKey: jest.fn(async () => undefined),
}));

jest.mock("@/nostr/keystore.nostr", () => ({
  getPublicKeyHexFromSecureStorage: jest.fn(async () => null),
}));

jest.mock("@/components/LoadingModal", () => () => null);

const mockUseAppSelector = useAppSelector as jest.Mock;

function freshInstallState() {
  return {
    settings: {
      isDataLoaded: true,
      username: undefined,
      hasBeenOpenedBefore: false,
      isBrowsingAsGuest: false,
      forceOnboarding: false,
      forceWelcome: false,
    },
    keystore: { publicKeyNpub: undefined },
  };
}

describe("IndexRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppSelector.mockImplementation((selector) =>
      selector(freshInstallState()),
    );
  });

  it("does not mark the app as opened; the welcome screen owns that", async () => {
    render(<IndexRoute />);

    expect(mockDispatch).not.toHaveBeenCalledWith(
      settingsActions.setHasBeenOpenedBefore(true),
    );
  });
});
