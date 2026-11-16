import { act, fireEvent } from "@testing-library/react-native";

import MapModal from "./MapModal";
import { renderWithProviders } from "@/test/test-utils";

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const React = require("react");
  const sheetState: { onDismiss?: () => void } = {};

  return {
    __triggerNativeDismiss: () => sheetState.onDismiss?.(),
    BottomSheetModal: React.forwardRef(
      (props: { onDismiss?: () => void; children?: React.ReactNode }, ref) => {
        sheetState.onDismiss = props.onDismiss;
        React.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          // Mirrors the real native sheet: dismissal completes asynchronously,
          // so `onDismiss` does not fire in the same tick as this call.
          dismiss: jest.fn(),
        }));
        return props.children ?? null;
      },
    ),
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});

const { __triggerNativeDismiss } = jest.requireMock(
  "@expo/ui/community/bottom-sheet",
) as { __triggerNativeDismiss: () => void };

const openModalState = {
  map: {
    isMapModalOpen: true,
    selectedPlusCode: "9C2X4W+2X",
    selectedLayer: "trustroots",
  },
  keystore: {
    hasPrivateKeyHexInSecureStorage: true,
  },
};

describe("MapModal", () => {
  it("does not open the event composer before the sheet has dismissed", () => {
    const { getByLabelText, store } = renderWithProviders(<MapModal />, {
      preloadedState: openModalState,
    });

    fireEvent.press(getByLabelText("Create event"));

    expect(store.getState().map.isEventComposerOpen).toBe(false);
  });

  it("opens the event composer once the sheet has dismissed", () => {
    const { getByLabelText, store } = renderWithProviders(<MapModal />, {
      preloadedState: openModalState,
    });

    fireEvent.press(getByLabelText("Create event"));
    act(() => __triggerNativeDismiss());

    expect(store.getState().map.isEventComposerOpen).toBe(true);
  });

  it("just closes the map modal when dismissed without creating an event", () => {
    const { getByLabelText, store } = renderWithProviders(<MapModal />, {
      preloadedState: openModalState,
    });

    fireEvent.press(getByLabelText("Close"));
    act(() => __triggerNativeDismiss());

    expect(store.getState().map.isEventComposerOpen).toBe(false);
    expect(store.getState().map.isMapModalOpen).toBe(false);
  });
});
