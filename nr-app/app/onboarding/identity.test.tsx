import { fireEvent } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import OnboardingIdentityScreen from "./identity";
import { ROUTES } from "@/constants/routes";
import { renderWithProviders } from "@/test/test-utils";

const mockUseRouter = useRouter as jest.Mock;

describe("OnboardingIdentityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("continues to the Trustroots username step", () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => false,
    });

    const { getByText } = renderWithProviders(<OnboardingIdentityScreen />);

    fireEvent.press(getByText("Continue"));

    expect(push).toHaveBeenCalledWith("/onboarding/trustroots");
  });

  it("shows skip when enabled and navigates home", () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => false,
    });

    const { getByText } = renderWithProviders(<OnboardingIdentityScreen />, {
      preloadedState: {
        settings: {
          useSkipOnboarding: true,
        },
      },
    });

    fireEvent.press(getByText("Skip"));

    expect(push).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it("hides skip when skip onboarding is disabled", () => {
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => false,
    });

    const { queryByText } = renderWithProviders(<OnboardingIdentityScreen />, {
      preloadedState: {
        settings: {
          useSkipOnboarding: false,
        },
      },
    });

    expect(queryByText("Skip")).toBeNull();
  });
});
