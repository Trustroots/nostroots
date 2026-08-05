import { waitFor } from "@testing-library/react-native";

import { ROUTES } from "@/constants/routes";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";
import { renderWithProviders } from "@/test/render";
import IndexRoute from "../../../app/index";

function loadedSettings(overrides = {}) {
  return {
    ...settingsSlice.getInitialState(),
    hasBeenOpenedBefore: true,
    isDataLoaded: true,
    ...overrides,
  };
}

describe("IndexRoute", () => {
  it("redirects first-time users to welcome", async () => {
    const { router } = renderWithProviders(<IndexRoute />, {
      preloadedState: {
        settings: loadedSettings({ hasBeenOpenedBefore: false }),
      },
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(ROUTES.WELCOME);
    });
  });

  it("redirects users without identity to onboarding", async () => {
    const { router } = renderWithProviders(<IndexRoute />, {
      preloadedState: {
        keystore: keystoreSlice.getInitialState(),
        settings: loadedSettings(),
      },
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(ROUTES.ONBOARDING);
    });
  });

  it("honors the force welcome feature flag", async () => {
    const { router } = renderWithProviders(<IndexRoute />, {
      preloadedState: {
        settings: loadedSettings({ forceWelcome: true }),
      },
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(ROUTES.WELCOME);
    });
  });
});
