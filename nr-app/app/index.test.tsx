import { Redirect } from "expo-router";
import { waitFor, screen } from "@testing-library/react-native";

import IndexRoute from "./index";
import { ROUTES } from "@/constants/routes";
import { renderWithProviders } from "@/test/test-utils";

const mockRedirect = Redirect as jest.Mock;

describe("IndexRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state while settings are hydrating", () => {
    renderWithProviders(<IndexRoute />, {
      preloadedState: {
        settings: {
          isDataLoaded: false,
        },
      },
    });

    expect(screen.UNSAFE_getByType("ActivityIndicator")).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("sends first-time users to the welcome screen", async () => {
    renderWithProviders(<IndexRoute />, {
      preloadedState: {
        settings: {
          isDataLoaded: true,
          hasBeenOpenedBefore: false,
        },
      },
    });

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith(
        { href: ROUTES.WELCOME },
        undefined,
      );
    });
  });

  it("sends returning users without identity to onboarding", async () => {
    renderWithProviders(<IndexRoute />, {
      preloadedState: {
        settings: {
          isDataLoaded: true,
          hasBeenOpenedBefore: true,
        },
      },
    });

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith(
        { href: ROUTES.ONBOARDING },
        undefined,
      );
    });
  });
});
