import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { NrBridgeError } from "@/services/nrBridge.service";
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
const profile = jest.requireMock("@/services/trustrootsProfile.service") as {
  finalizeTrustrootsProfilePublish: jest.Mock;
};

describe("OnboardingTrustrootsScreen", () => {
  beforeEach(() => {
    bridge.authenticateWithCode.mockResolvedValue(undefined);
    bridge.requestVerificationToken.mockResolvedValue(undefined);
    profile.finalizeTrustrootsProfilePublish.mockResolvedValue(undefined);
  });

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

  it("resumes code entry when verification is already pending", async () => {
    bridge.requestVerificationToken.mockRejectedValueOnce(
      new NrBridgeError({
        code: "already-pending",
        status: 409,
        message: "Verification already pending",
      }),
    );
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("your-username"), "Alice");
    fireEvent.press(screen.getByText("Verify Trustroots email"));

    await waitFor(() => {
      expect(screen.getByText("Six-digit code")).toBeTruthy();
      expect(
        screen.getByText(
          "A verification code is already pending. Check your Trustroots email.",
        ),
      ).toBeTruthy();
    });
  });

  it("shows a username error when Trustroots has no matching account", async () => {
    bridge.requestVerificationToken.mockRejectedValueOnce(
      new NrBridgeError({
        code: "not-found",
        status: 404,
        message: "User not found",
      }),
    );
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("your-username"), "Alice");
    fireEvent.press(screen.getByText("Verify Trustroots email"));

    await waitFor(() => {
      expect(screen.getByText("Trustroots username not found.")).toBeTruthy();
    });
  });

  it("reports verification service configuration errors", async () => {
    bridge.requestVerificationToken.mockRejectedValueOnce(
      new NrBridgeError({
        code: "config",
        message: "nr-bridge base URL is not configured.",
      }),
    );
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("your-username"), "Alice");
    fireEvent.press(screen.getByText("Verify Trustroots email"));

    await waitFor(() => {
      expect(
        screen.getByText("Verification service is not configured."),
      ).toBeTruthy();
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

  it("returns to username entry when code authentication fails", async () => {
    bridge.authenticateWithCode.mockRejectedValueOnce(new Error("bad code"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    renderWithProviders(<OnboardingTrustrootsScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          pendingTrustrootsUsername: "alice",
        },
      },
    });

    fireEvent.changeText(screen.getByPlaceholderText("123456"), "123456");
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(
        screen.getByText("failed to authenticate you. try again"),
      ).toBeTruthy();
      expect(screen.getByText("Verify Trustroots email")).toBeTruthy();
    });
    consoleError.mockRestore();
  });

  it("allows retrying profile publication after verification", async () => {
    const { router } = renderWithProviders(<OnboardingTrustrootsScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          pendingTrustrootsProfileUsername: "alice",
        },
      },
    });

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => {
      expect(profile.finalizeTrustrootsProfilePublish).toHaveBeenCalledWith(
        "alice",
        expect.any(Function),
      );
      expect(router.replace).toHaveBeenCalledWith(
        "/onboarding/backup-confirm?from=bridge",
      );
    });
  });
});
