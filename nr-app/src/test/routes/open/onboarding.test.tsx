import { renderWithProviders } from "@/test/render";
import OpenOnboardingRoute from "../../../../app/open/onboarding";

describe("OpenOnboardingRoute", () => {
  it("opens Trustroots onboarding and preserves the username", () => {
    const { router } = renderWithProviders(<OpenOnboardingRoute />, {
      searchParams: { username: "guaka" },
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/onboarding/trustroots",
      params: { username: "guaka" },
    });
  });

  it("opens Trustroots onboarding without requiring a username", () => {
    const { router } = renderWithProviders(<OpenOnboardingRoute />);

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/onboarding/trustroots",
      params: undefined,
    });
  });
});
