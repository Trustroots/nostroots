import { fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import WelcomeScreen from "./welcome";

const mockUseRouter = useRouter as jest.Mock;

describe("WelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("moves users into onboarding from the welcome screen", () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace,
      back: jest.fn(),
    });

    const { getByText } = render(<WelcomeScreen />);

    expect(getByText("Welcome to Nostroots")).toBeTruthy();
    fireEvent.press(getByText("Get Started"));

    expect(replace).toHaveBeenCalledWith("/onboarding");
  });
});
