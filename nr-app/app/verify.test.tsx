import { waitFor } from "@testing-library/react-native";

import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import VerifyRoute from "./verify";

jest.mock("@/services/nrBridge.service", () => ({
  authenticateWithToken: jest.fn(async () => undefined),
}));

jest.mock("@/services/onboardingIdentity.service", () => ({
  ensureOnboardingIdentity: jest.fn(async () => ({ npub: "npub1test" })),
}));

jest.mock("@/services/trustrootsProfile.service", () => ({
  finalizeTrustrootsProfilePublish: jest.fn(async () => undefined),
}));

const bridge = jest.requireMock("@/services/nrBridge.service") as {
  authenticateWithToken: jest.Mock;
};

describe("VerifyRoute", () => {
  it("routes to Trustroots when the token is missing", async () => {
    const { router } = renderWithProviders(<VerifyRoute />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        "/onboarding/trustroots?error=missing-token",
      );
    });
  });

  it("routes to Trustroots when verification did not start in app", async () => {
    const { router } = renderWithProviders(<VerifyRoute />, {
      searchParams: { token: "token-1" },
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        "/onboarding/trustroots?error=start-in-app",
      );
    });
  });

  it("authenticates token for a pending username", async () => {
    const { router } = renderWithProviders(<VerifyRoute />, {
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          pendingTrustrootsUsername: "alice",
        },
      },
      searchParams: { token: "token-1" },
    });

    await waitFor(() => {
      expect(bridge.authenticateWithToken).toHaveBeenCalledWith({
        npub: "npub1test",
        token: "token-1",
        username: "alice",
      });
      expect(router.replace).toHaveBeenCalledWith(
        "/onboarding/backup-confirm?from=bridge",
      );
    });
  });
});
