import { fireEvent, screen } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import MapLayerSelector from "./MapLayerSelector";

jest.mock("nativewind", () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: "light" }),
}));

describe("MapLayerSelector", () => {
  it("selects a layer when experimental layers are acknowledged", () => {
    const { store } = renderWithProviders(<MapLayerSelector />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          hasAcknowledgedExperimentalLayers: true,
        },
      },
    });

    fireEvent.press(screen.getByText("Trustroots"));
    fireEvent.press(screen.getByText("Hitchmap"));

    expect(store.getState().map.selectedLayer).toBe("hitchmap");
  });
});
