import { render, screen, userEvent } from "@testing-library/react-native";

import WelcomeScreen from "./welcome";
import { settingsActions } from "@/redux/slices/settings.slice";

const mockDispatch = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records that welcome was dismissed before navigating to onboarding", async () => {
    render(<WelcomeScreen />);

    await userEvent.press(screen.getByTestId("welcome-get-started"));

    expect(mockDispatch).toHaveBeenCalledWith(
      settingsActions.setHasBeenOpenedBefore(true),
    );
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });
});
