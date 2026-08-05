import { act, fireEvent, waitFor } from "@testing-library/react-native";
import Toast from "react-native-root-toast";

import { trackEvent } from "@/services/analytics.service";
import { createTestStore, renderWithProviders } from "@/test/test-utils";
import AddNoteForm from "./AddNoteForm";

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: "DateTimePicker",
}));

jest.mock("@/services/analytics.service", () => ({
  trackEvent: jest.fn(),
}));

const selectedLocationState = {
  map: {
    selectedPlusCode: "9F4MGCG4+5X",
  },
};

function getPublishedTemplate(dispatchSpy: jest.SpyInstance) {
  const action = dispatchSpy.mock.calls.at(-1)?.[0];
  return action.payload.eventTemplate;
}

describe("AddNoteForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("explains why a note cannot be sent without a selected location", () => {
    const { getByPlaceholderText } = renderWithProviders(<AddNoteForm />);
    const input = getByPlaceholderText("Share a tip or say hi...");

    fireEvent.changeText(input, "Tea at my place");
    fireEvent(input, "submitEditing");

    expect(Toast.show).toHaveBeenCalledWith(
      "Error: No plus code selected. #Rjbe0s",
      expect.objectContaining({ duration: Toast.durations.LONG }),
    );
  });

  it("rejects content that is too short after trimming", () => {
    const { getByPlaceholderText, store } = renderWithProviders(
      <AddNoteForm />,
      { preloadedState: selectedLocationState },
    );
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const input = getByPlaceholderText("Share a tip or say hi...");

    fireEvent.changeText(input, " x ");
    fireEvent(input, "submitEditing");

    expect(Toast.show).toHaveBeenCalledWith(
      "Note must be at least 3 characters long",
      expect.objectContaining({ duration: Toast.durations.LONG }),
    );
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("publishes trimmed content with the selected duration", async () => {
    const onSent = jest.fn();
    const store = createTestStore(selectedLocationState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const { getByPlaceholderText, getByRole, getByText, queryByText } =
      renderWithProviders(<AddNoteForm onSent={onSent} />, { store });

    fireEvent.press(getByText("Today"));
    fireEvent.changeText(
      getByPlaceholderText("Share a tip or say hi..."),
      "  Hosting tea in Berlin  ",
    );
    fireEvent.press(getByRole("button"));

    expect(onSent).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryByText("sending...")).toBeNull());

    const template = getPublishedTemplate(dispatchSpy);
    expect(template).toEqual(
      expect.objectContaining({
        content: "Hosting tea in Berlin",
        kind: 30397,
        created_at: 1_800_000_000,
      }),
    );
    expect(template.tags).toContainEqual(["expiration", "1800086400"]);
    expect(trackEvent).toHaveBeenCalledWith("note_published", {
      intent: "none",
      outcome: "success",
    });
  });

  it("publishes a signal with its intent and exits signal mode", async () => {
    const onSignalSent = jest.fn();
    const store = createTestStore(selectedLocationState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const { getByPlaceholderText, getByRole, getByText } = renderWithProviders(
      <AddNoteForm signalMode onSignalSent={onSignalSent} />,
      { store },
    );

    fireEvent.press(getByText("☕"));
    fireEvent.changeText(
      getByPlaceholderText("Anyone down for coffee?"),
      "Coffee near the park",
    );
    fireEvent.press(getByRole("button"));

    await waitFor(() => expect(onSignalSent).toHaveBeenCalledTimes(1));
    const template = getPublishedTemplate(dispatchSpy);
    expect(template.tags).toEqual(
      expect.arrayContaining([
        ["t", "signal"],
        ["t", "coffee"],
      ]),
    );
    expect(trackEvent).toHaveBeenCalledWith("note_published", {
      intent: "coffee",
      outcome: "success",
    });
  });

  it("shows failed optimistic notes and retries them", async () => {
    const store = createTestStore(selectedLocationState);
    const dispatchSpy = jest
      .spyOn(store, "dispatch")
      .mockRejectedValueOnce(new Error("relay unavailable"))
      .mockResolvedValueOnce(undefined);
    const { getByLabelText, getByPlaceholderText, getByRole, getByText } =
      renderWithProviders(<AddNoteForm />, { store });

    fireEvent.changeText(
      getByPlaceholderText("Share a tip or say hi..."),
      "Meet at the station",
    );
    fireEvent.press(getByRole("button"));

    await waitFor(() => expect(getByText("tap to retry")).toBeTruthy());
    expect(trackEvent).toHaveBeenCalledWith("note_published", {
      intent: "none",
      outcome: "failure",
    });

    fireEvent.press(getByLabelText("Retry publishing note"));

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith("note_publish_retried", {
        outcome: "success",
      });
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });

  it("marks a publish as retryable when the relay response times out", async () => {
    jest.useFakeTimers();
    const store = createTestStore(selectedLocationState);
    jest
      .spyOn(store, "dispatch")
      .mockImplementation(() => new Promise(() => undefined));
    const { getByPlaceholderText, getByRole, getByText } = renderWithProviders(
      <AddNoteForm />,
      { store },
    );

    fireEvent.changeText(
      getByPlaceholderText("Share a tip or say hi..."),
      "Waiting for relays",
    );
    fireEvent.press(getByRole("button"));
    expect(getByText("sending...")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(getByText("tap to retry")).toBeTruthy();
  });

  it("shows the remaining character count near the content limit", () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <AddNoteForm />,
      { preloadedState: selectedLocationState },
    );

    fireEvent.changeText(
      getByPlaceholderText("Share a tip or say hi..."),
      "a".repeat(3_801),
    );

    expect(getByText("199 characters left")).toBeTruthy();
  });
});
