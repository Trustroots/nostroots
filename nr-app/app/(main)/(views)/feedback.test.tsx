import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import FeedbackScreen from "./feedback";
import { sendSupportMessage } from "@/services/nrBridge.service";
import {
  formatSupportMessage,
  MAX_USER_MESSAGE_LENGTH,
  MIN_USER_MESSAGE_LENGTH,
} from "@/utils/debugInfo.utils";

jest.mock("@/services/nrBridge.service", () => ({
  sendSupportMessage: jest.fn(),
}));

jest.mock("@/nostr/keystore.nostr", () => ({
  signEventTemplate: jest.fn(),
}));

jest.mock("@/hooks/useDebugInfo", () => ({
  useDebugInfo: () => "Nostroots debug info\nnpub: npub1abc",
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

const mockSend = sendSupportMessage as jest.Mock;
const mockClipboard = Clipboard.setStringAsync as jest.Mock;
const mockOpenBrowser = WebBrowser.openBrowserAsync as jest.Mock;

const LONG_ENOUGH =
  "The map stays blank after login, even once I pan around a bit.";

describe("FeedbackScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  it("disables submit until the message is long enough", () => {
    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);
    const submit = getByRole("button", { name: "Send feedback" });

    expect(submit).toBeDisabled();

    fireEvent.changeText(getByPlaceholderText(/what happened/i), "too short");
    expect(submit).toBeDisabled();

    fireEvent.changeText(getByPlaceholderText(/what happened/i), LONG_ENOUGH);
    expect(submit).toBeEnabled();
  });

  it("sends the message with the debug block appended", async () => {
    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);

    fireEvent.changeText(getByPlaceholderText(/what happened/i), LONG_ENOUGH);
    fireEvent.press(getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));

    const { message } = mockSend.mock.calls[0][0];
    expect(message).toBe(
      formatSupportMessage({
        userMessage: LONG_ENOUGH,
        debugInfo: "Nostroots debug info\nnpub: npub1abc",
      }),
    );

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    buttons[0].onPress();
    expect(getByPlaceholderText(/what happened/i).props.value).toBe("");
  });

  it("keeps the user's text when sending fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("offline"));

    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);
    const input = getByPlaceholderText(/what happened/i);

    fireEvent.changeText(input, LONG_ENOUGH);
    fireEvent.press(getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    expect(input.props.value).toBe(LONG_ENOUGH);
    expect(mockClipboard).toHaveBeenCalledWith(
      formatSupportMessage({
        userMessage: LONG_ENOUGH,
        debugInfo: "Nostroots debug info\nnpub: npub1abc",
      }),
    );

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    buttons[1].onPress();
    expect(mockOpenBrowser).toHaveBeenCalledWith(
      "https://www.trustroots.org/support",
    );
  });

  it("shows focus styling while the message field is active", () => {
    const { getByPlaceholderText } = render(<FeedbackScreen />);
    const input = getByPlaceholderText(/what happened/i);

    fireEvent(input, "focus");
    expect(input.props.className).toContain("border-primary");

    fireEvent(input, "blur");
    expect(input.props.className).toContain("border-border");
  });

  it("shows each limit only while it is the relevant one", () => {
    const { getByText, queryByText, getByPlaceholderText } = render(
      <FeedbackScreen />,
    );
    const input = getByPlaceholderText(/what happened/i);

    expect(
      getByText(`${MIN_USER_MESSAGE_LENGTH} characters minimum`),
    ).toBeTruthy();
    expect(queryByText(/\//)).toBeNull();

    fireEvent.changeText(input, LONG_ENOUGH);
    expect(queryByText(/characters minimum/)).toBeNull();
    expect(queryByText(/\//)).toBeNull();

    fireEvent.changeText(input, "y".repeat(MAX_USER_MESSAGE_LENGTH - 10));
    expect(
      getByText(`${MAX_USER_MESSAGE_LENGTH - 10}/${MAX_USER_MESSAGE_LENGTH}`),
    ).toBeTruthy();

    fireEvent.changeText(input, "y".repeat(MAX_USER_MESSAGE_LENGTH + 3));
    expect(
      getByText(`${MAX_USER_MESSAGE_LENGTH + 3}/${MAX_USER_MESSAGE_LENGTH}`),
    ).toBeTruthy();
  });

  it("blocks submission when the message is over the limit", () => {
    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);

    fireEvent.changeText(
      getByPlaceholderText(/what happened/i),
      "y".repeat(MAX_USER_MESSAGE_LENGTH + 1),
    );

    expect(getByRole("button", { name: "Send feedback" })).toBeDisabled();
  });

  it("reveals the debug block only when the disclosure is expanded", () => {
    const { getByText, queryByText } = render(<FeedbackScreen />);

    expect(queryByText(/npub1abc/)).toBeNull();
    fireEvent.press(getByText("What we send with this"));
    expect(getByText(/npub1abc/)).toBeTruthy();
  });
});
