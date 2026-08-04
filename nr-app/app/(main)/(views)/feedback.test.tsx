import { fireEvent, render, waitFor } from "@testing-library/react-native";

import FeedbackScreen from "./feedback";
import { sendSupportMessage } from "@/services/nrBridge.service";
import {
  formatSupportMessage,
  getUserMessageBudget,
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

const LONG_ENOUGH =
  "The map stays blank after login, even once I pan around a bit.";

describe("FeedbackScreen", () => {
  beforeEach(() => jest.clearAllMocks());

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
  });

  it("keeps the user's text when sending fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("offline"));

    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);
    const input = getByPlaceholderText(/what happened/i);

    fireEvent.changeText(input, LONG_ENOUGH);
    fireEvent.press(getByRole("button", { name: "Send feedback" }));

    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    expect(input.props.value).toBe(LONG_ENOUGH);
  });

  it("shows each limit only while it is the relevant one", () => {
    const { getByText, queryByText, getByPlaceholderText } = render(
      <FeedbackScreen />,
    );
    const input = getByPlaceholderText(/what happened/i);
    const budget = getUserMessageBudget("Nostroots debug info\nnpub: npub1abc");

    expect(
      getByText(`${MIN_USER_MESSAGE_LENGTH} characters minimum`),
    ).toBeTruthy();
    expect(queryByText(/\//)).toBeNull();

    fireEvent.changeText(input, LONG_ENOUGH);
    expect(queryByText(/characters minimum/)).toBeNull();
    expect(queryByText(/\//)).toBeNull();

    fireEvent.changeText(input, "y".repeat(budget - 10));
    expect(getByText(`${budget - 10}/${budget}`)).toBeTruthy();

    fireEvent.changeText(input, "y".repeat(budget + 3));
    expect(getByText(`${budget + 3}/${budget}`)).toBeTruthy();
  });

  it("blocks submission when the message is over the limit", () => {
    const { getByRole, getByPlaceholderText } = render(<FeedbackScreen />);
    const budget = getUserMessageBudget("Nostroots debug info\nnpub: npub1abc");

    fireEvent.changeText(
      getByPlaceholderText(/what happened/i),
      "y".repeat(budget + 1),
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
