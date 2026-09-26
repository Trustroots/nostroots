import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import MapLayout from "./_layout";
import { useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
  useAppDispatch: jest.fn(() => jest.fn()),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;

function fakeState(
  areTestFeaturesEnabled: boolean,
  selectedPlusCode = "",
  isEventComposerOpen = false,
) {
  return {
    settings: {
      areTestFeaturesEnabled,
    },
    map: {
      selectedPlusCode,
      isEventComposerOpen,
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

  it("does not put a create event button in the map overlay", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true, "9C2X4W+2X")),
    );
    expect(renderMapLayout().queryByLabelText("Create event")).toBeNull();
  });

  it("renders the event composer when it is open in state", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false, "9C2X4W+2X", true)),
    );
    expect(renderMapLayout().queryByLabelText("Back")).toBeTruthy();
  });

  it("keeps the event composer closed by default", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false, "9C2X4W+2X")),
    );
    expect(renderMapLayout().queryByLabelText("Back")).toBeNull();
  });
});
