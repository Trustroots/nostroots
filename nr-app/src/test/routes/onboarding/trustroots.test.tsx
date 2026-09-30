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
  it("pre-fills a valid username from an onboarding link", () => {
    renderWithProviders(<OnboardingTrustrootsScreen />, {
      searchParams: { username: "Guaka" },
    });

    expect(screen.getByPlaceholderText("your-username").props.value).toBe(
      "guaka",
    );
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

  it("tells the user to wait when nr-bridge rate-limits the request", async () => {
    const { NrBridgeError } = jest.requireActual("@/services/nrBridge.service");
    bridge.requestVerificationToken.mockRejectedValueOnce(
      new NrBridgeError({
        code: "rate-limited",
        status: 429,
        message: "Too many verification requests, try again later",
      }),
    );
    renderWithProviders(<OnboardingTrustrootsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("your-username"), "Alice");
    fireEvent.press(screen.getByText("Verify Trustroots email"));

    expect(
      await screen.findByText(
        "Too many verification codes requested. Try again in an hour.",
      ),
    ).toBeTruthy();
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

  function renderCodeEntry() {
    return renderWithProviders(<OnboardingTrustrootsScreen />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          pendingTrustrootsUsername: "alice",
        },
      },
    });
  }

  function submitCode() {
    fireEvent.changeText(screen.getByPlaceholderText("123456"), "000000");
    fireEvent.press(screen.getByText("Verify code"));
  }

  it("keeps the code field after a wrong code and says how many tries are left", async () => {
    const { NrBridgeError } = jest.requireActual("@/services/nrBridge.service");
    bridge.authenticateWithCode.mockRejectedValueOnce(
      new NrBridgeError({
        code: "wrong-code",
        status: 401,
        message: "Invalid code or token",
        attemptsLeft: 3,
      }),
    );
    renderCodeEntry();

    submitCode();

    expect(
      await screen.findByText("That code is wrong. Try again (3 tries left)."),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("123456").props.value).toBe("");
    expect(screen.getByText("Verify code")).toBeTruthy();
  });

  it("sends the user back to request a new email when the code has expired", async () => {
    const { NrBridgeError } = jest.requireActual("@/services/nrBridge.service");
    bridge.authenticateWithCode.mockRejectedValueOnce(
      new NrBridgeError({
        code: "invalid-or-expired",
        status: 401,
        message: "No pending verification or code expired",
      }),
    );
    renderCodeEntry();

    submitCode();

    expect(
      await screen.findByText(
        "That code has expired or had too many wrong tries. Request a new email.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Verify Trustroots email")).toBeTruthy();
    expect(screen.queryByPlaceholderText("123456")).toBeNull();
  });

  it("keeps the code field when the verification service can't be reached", async () => {
    const { NrBridgeError } = jest.requireActual("@/services/nrBridge.service");
    bridge.authenticateWithCode.mockRejectedValueOnce(
      new NrBridgeError({ code: "network", message: "Could not reach" }),
    );
    renderCodeEntry();

    submitCode();

    expect(
      await screen.findByText(
        "Could not reach the verification service. Try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Verify code")).toBeTruthy();
  });
});
