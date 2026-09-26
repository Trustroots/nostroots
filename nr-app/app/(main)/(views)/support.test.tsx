import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-root-toast";

import SupportScreen from "./support";
import { TRUSTROOTS_SUPPORT_URL } from "@/utils/debugInfo.utils";

const DEBUG_INFO = "Nostroots debug info\nApp version: 0.0.4";

jest.mock("@/hooks/useDebugInfo", () => ({
  useDebugInfo: () => DEBUG_INFO,
}));

describe("SupportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the debug info", () => {
    render(<SupportScreen />);

    expect(screen.getByText(DEBUG_INFO)).toBeTruthy();
  });

  it("copies the debug info to the clipboard", async () => {
    render(<SupportScreen />);

    fireEvent.press(screen.getByText("Copy debug info"));

    await waitFor(() => expect(Toast.show).toHaveBeenCalled());
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(DEBUG_INFO);
  });

  it("opens the Trustroots support page", () => {
    render(<SupportScreen />);

    fireEvent.press(screen.getByText("Open Trustroots support"));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      TRUSTROOTS_SUPPORT_URL,
    );
  });
});
