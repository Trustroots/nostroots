import { fireEvent, screen } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";
import WelcomeScreen from "./welcome";

describe("WelcomeScreen", () => {
  it("renders first-impression copy and starts onboarding", () => {
    const { router } = renderWithProviders(<WelcomeScreen />);

    expect(screen.getByText("Welcome to Nostroots")).toBeTruthy();
    expect(screen.getByText(/Connect with travelers and locals/)).toBeTruthy();

    fireEvent.press(screen.getByText("Get Started"));

    expect(router.replace).toHaveBeenCalledWith("/onboarding");
  });
});
