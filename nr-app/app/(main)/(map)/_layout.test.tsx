import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import MapLayout from "./_layout";
import { useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;

function fakeState(
  areTestFeaturesEnabled: boolean,
  publicKeyNpub: string | null = "npub1aabbcc",
) {
  return {
    settings: {
      areTestFeaturesEnabled,
    },
    keystore: {
      publicKeyNpub: publicKeyNpub ?? undefined,
    },
  };
}

function renderMapLayout() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <MapLayout />
    </SafeAreaProvider>,
  );
}

describe("MapLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the NIP-07 browser icon only when Developer Mode is on", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false)),
    );
    const { queryByLabelText, rerender } = renderMapLayout();

    expect(queryByLabelText("Open NIP-07 Browser")).toBeNull();

    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true)),
    );
    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <MapLayout />
      </SafeAreaProvider>,
    );

    expect(queryByLabelText("Open NIP-07 Browser")).toBeTruthy();
  });

  it("shows the feedback button only once a key exists", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false, null)),
    );
    const { queryByLabelText, rerender } = renderMapLayout();

    expect(queryByLabelText("Send feedback")).toBeNull();

    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false, "npub1aabbcc")),
    );
    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <MapLayout />
      </SafeAreaProvider>,
    );

    expect(queryByLabelText("Send feedback")).toBeTruthy();
  });
});
