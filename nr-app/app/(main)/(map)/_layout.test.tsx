import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import MapLayout from "./_layout";
import { useAppSelector } from "@/redux/hooks";

jest.mock("@/redux/hooks", () => ({
  useAppSelector: jest.fn(),
  useAppDispatch: jest.fn(() => jest.fn()),
}));

const mockUseAppSelector = useAppSelector as jest.Mock;

function fakeState(areTestFeaturesEnabled: boolean, selectedPlusCode = "") {
  return {
    settings: {
      areTestFeaturesEnabled,
    },
    map: {
      selectedPlusCode,
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

  it("hides the create event button when Developer Mode is off", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(false, "9C2X4W+2X")),
    );
    expect(renderMapLayout().queryByLabelText("Create event")).toBeNull();
  });

  it("hides the create event button until a plus code is selected", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true, "")),
    );
    expect(renderMapLayout().queryByLabelText("Create event")).toBeNull();
  });

  it("shows the create event button in Developer Mode for a selected plus code", () => {
    mockUseAppSelector.mockImplementation((selector) =>
      selector(fakeState(true, "9C2X4W+2X")),
    );
    expect(renderMapLayout().queryByLabelText("Create event")).toBeTruthy();
  });
});
