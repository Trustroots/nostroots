import { act, fireEvent, within } from "@testing-library/react-native";
import { Platform } from "react-native";

import { renderWithProviders } from "@/test/test-utils";
import EventComposerModal from "./EventComposerModal";

const mockOpen = jest.fn();
const mockDismiss = jest.fn();
const mockPickerMounted = jest.fn();

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  const DateTimePicker = (props: { testID?: string }) => {
    mockPickerMounted(props);
    return <View testID="inline-picker" />;
  };
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: {
      open: (...args: unknown[]) => mockOpen(...args),
      dismiss: (...args: unknown[]) => mockDismiss(...args),
    },
  };
});

const preloaded = {
  map: { selectedPlusCode: "9C2X4W+2X" },
} as never;

describe("EventComposerModal on Android", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("opens no picker on mount or while typing", () => {
    const { getByPlaceholderText } = renderWithProviders(
      <EventComposerModal visible onClose={jest.fn()} />,
      { preloadedState: preloaded },
    );

    fireEvent.changeText(
      getByPlaceholderText("e.g. Community potluck dinner"),
      "Potluck",
    );

    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockPickerMounted).not.toHaveBeenCalled();
  });

  it("opens exactly one dialog per button press and applies the choice", () => {
    const { getByLabelText } = renderWithProviders(
      <EventComposerModal visible onClose={jest.fn()} />,
      { preloadedState: preloaded },
    );

    fireEvent.press(getByLabelText("Pick start date"));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0]).toMatchObject({ mode: "date" });

    const picked = new Date("2030-01-02T10:00:00Z");
    act(() => {
      mockOpen.mock.calls[0][0].onChange(
        { type: "set", nativeEvent: {} },
        picked,
      );
    });

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps the value when the dialog is dismissed", () => {
    const { getByLabelText } = renderWithProviders(
      <EventComposerModal visible onClose={jest.fn()} />,
      { preloadedState: preloaded },
    );
    const snapshot = () =>
      within(getByLabelText("Pick start time")).getByText(/.+/).props.children;

    const before = snapshot();

    fireEvent.press(getByLabelText("Pick start time"));
    act(() => {
      mockOpen.mock.calls[0][0].onChange(
        { type: "dismissed", nativeEvent: {} },
        new Date("2031-01-01T00:00:00Z"),
      );
    });

    expect(snapshot()).toBe(before);
  });
});

describe("EventComposerModal on iOS", () => {
  it("keeps compact inline pickers", () => {
    Platform.OS = "ios";
    const { getAllByTestId } = renderWithProviders(
      <EventComposerModal visible onClose={jest.fn()} />,
      { preloadedState: preloaded },
    );

    expect(getAllByTestId("inline-picker")).toHaveLength(2);
  });
});
