import { render } from "@testing-library/react-native";

import SettingsScreen from "./settings";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

jest.mock("@/hooks/useKeyImport", () => ({
  useKeyImport: () => ({
    importKey: jest.fn(),
    isImporting: false,
  }),
}));

jest.mock("@/components/BuildData", () => () => null);

const mockUseAppDispatch = useAppDispatch as jest.Mock;
const mockUseAppSelector = useAppSelector as jest.Mock;

function fakeState(areTestFeaturesEnabled: boolean) {
  return {
    settings: {
      username: "alice",
      hasBeenOpenedBefore: true,
      isDataLoaded: true,
      areTestFeaturesEnabled,
      useSkipOnboarding: true,
      forceOnboarding: false,
      forceWelcome: false,
      colorScheme: "system",
      keyWasImported: false,
      hasAcknowledgedExperimentalLayers: false,
      pendingTrustrootsUsername: null,
      pendingTrustrootsProfileUsername: null,
    },
    keystore: {
      hasPrivateKeyHexInSecureStorage: true,
      hasPrivateKeyMnemonicInSecureStorage: false,
      publicKeyNpub: "npub1example",
      publicKeyHex: "1".repeat(64),
      isLoaded: true,
    },
    notifications: {
      filters: [],
      tokens: [],
    },
  };
}

describe("SettingsScreen dev browser entry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it("shows the NIP-07 browser button only when Developer Mode is on", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false)),
    );
    const { queryByText, rerender } = render(<SettingsScreen />);

    expect(queryByText("Open NIP-07 Browser")).toBeNull();

    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true)),
    );
    rerender(<SettingsScreen />);

    expect(queryByText("Open NIP-07 Browser")).toBeTruthy();
  });
});
