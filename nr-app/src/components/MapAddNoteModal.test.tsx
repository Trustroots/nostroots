import { fireEvent, waitFor } from "@testing-library/react-native";
import Toast from "react-native-root-toast";

import MapAddNoteModal from "./MapAddNoteModal";
import { renderWithProviders } from "@/test/test-utils";

const openModalState = {
  map: {
    isAddNoteModalOpen: true,
    selectedLatLng: {
      latitude: 52.52,
      longitude: 13.405,
    },
  },
};

describe("MapAddNoteModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not publish an empty note", () => {
    const { getByText, store } = renderWithProviders(<MapAddNoteModal />, {
      preloadedState: openModalState,
    });
    const dispatchSpy = jest.spyOn(store, "dispatch");

    fireEvent.press(getByText("Add Note"));

    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "publish/eventTemplate/request" }),
    );
  });

  it("dispatches a map note publish request for valid content", async () => {
    const { getByPlaceholderText, getByText, store } = renderWithProviders(
      <MapAddNoteModal />,
      {
        preloadedState: openModalState,
      },
    );
    const dispatchSpy = jest.spyOn(store, "dispatch");

    fireEvent.changeText(
      getByPlaceholderText("Enter your note"),
      "Hosting tea in Berlin",
    );
    fireEvent.press(getByText("Add Note"));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "publish/eventTemplate/request",
          payload: {
            eventTemplate: expect.objectContaining({
              content: "Hosting tea in Berlin",
              kind: 30397,
            }),
          },
        }),
      );
      expect(Toast.show).toHaveBeenCalledWith(
        "Note added successfully",
        expect.objectContaining({ duration: Toast.durations.LONG }),
      );
    });
  });
});
