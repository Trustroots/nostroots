import { render, screen, userEvent } from "@testing-library/react-native";

import { settingsActions } from "@/redux/slices/settings.slice";
import { getRouterMock } from "@/test/router";
import WelcomeScreen from "./welcome";

const mockDispatch = jest.fn();

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it("records that welcome was dismissed before navigating to onboarding", async () => {
    render(<WelcomeScreen />);

    expect(screen.getByText("Welcome to Nostroots")).toBeTruthy();
    await userEvent.press(screen.getByTestId("welcome-get-started"));

    expect(mockDispatch).toHaveBeenCalledWith(
      settingsActions.setHasBeenOpenedBefore(true),
    );
    expect(getRouterMock().replace).toHaveBeenCalledWith("/onboarding");
  });
});
