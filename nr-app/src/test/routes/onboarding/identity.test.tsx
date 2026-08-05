import { fireEvent, screen } from "@testing-library/react-native";

import { ROUTES } from "@/constants/routes";
import { renderWithProviders } from "@/test/render";
import OnboardingIdentityScreen from "../../../../app/onboarding/identity";

describe("OnboardingIdentityScreen", () => {
  it("continues to Trustroots verification", () => {
    const { router } = renderWithProviders(<OnboardingIdentityScreen />);

    fireEvent.press(screen.getByText("Continue"));

    expect(router.push).toHaveBeenCalledWith("/onboarding/trustroots");
  });

  it("allows browsing as a guest", () => {
    const { router } = renderWithProviders(<OnboardingIdentityScreen />);

    fireEvent.press(screen.getByText("Browse first"));

    expect(router.replace).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("shows back when router can go back", () => {
    const { router } = renderWithProviders(<OnboardingIdentityScreen />, {
      canGoBack: true,
    });
    fireEvent.press(screen.getByText("Back"));

    expect(router.back).toHaveBeenCalled();
  });
});
