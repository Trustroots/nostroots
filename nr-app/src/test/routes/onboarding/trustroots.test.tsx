import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import OnboardingTrustrootsScreen from "../../../../app/onboarding/trustroots";

jest.mock("@/services/nrBridge.service", () => {
  const actual = jest.requireActual("@/services/nrBridge.service");
  return {
    ...actual,
    authenticateWithCode: jest.fn(async () => undefined),
    requestVerificationToken: jest.fn(async () => undefined),
  };
});

jest.mock("@/services/onboardingIdentity.service", () => ({
  ensureOnboardingIdentity: jest.fn(async () => ({ npub: "npub1test" })),
}));

jest.mock("@/services/trustrootsProfile.service", () => ({
  finalizeTrustrootsProfilePublish: jest.fn(async () => undefined),
}));

const bridge = jest.requireMock("@/services/nrBridge.service") as {
  authenticateWithCode: jest.Mock;
  requestVerificationToken: jest.Mock;
};

describe("OnboardingTrustrootsScreen", () => {
  it("validates username before requesting a code", () => {
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.press(screen.getByText("Verify Trustroots email"));

    expect(screen.getByText("Enter your Trustroots username.")).toBeTruthy();
    expect(bridge.requestVerificationToken).not.toHaveBeenCalled();
  });

  it("requests a code and enters code-entry state", async () => {
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("your-username"), "Alice");
    fireEvent.press(screen.getByText("Verify Trustroots email"));

    await waitFor(() => {
      expect(bridge.requestVerificationToken).toHaveBeenCalledWith("alice");
      expect(screen.getByText("Six-digit code")).toBeTruthy();
    });
  });

  it("authenticates a six-digit code and routes to backup", async () => {
    const { router } = renderWithProviders(<OnboardingTrustrootsScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          pendingTrustrootsUsername: "alice",
        },
      },
    });

    fireEvent.changeText(screen.getByPlaceholderText("123456"), "12a3456");
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(bridge.authenticateWithCode).toHaveBeenCalledWith({
        code: "123456",
        npub: "npub1test",
        username: "alice",
      });
      expect(router.replace).toHaveBeenCalledWith(
        "/onboarding/backup-confirm?from=bridge",
      );
    });
  });
});
