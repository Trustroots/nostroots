import { ROUTES } from "@/constants/routes";
import { resolveStartupRoute } from "./startupRoute.utils";

const onboardedUser = {
  hasBeenOpenedBefore: true,
  username: "alice",
  npub: "npub1alice" as `npub${string}`,
  nip5Error: false,
  isBrowsingAsGuest: false,
  forceOnboarding: false,
  forceWelcome: false,
};

const freshUser = {
  ...onboardedUser,
  hasBeenOpenedBefore: false,
  username: null,
  npub: undefined,
};

describe("resolveStartupRoute", () => {
  it("sends a first-time user to the welcome screen", () => {
    expect(resolveStartupRoute(freshUser)).toBe(ROUTES.WELCOME);
  });

  it("sends a returning user with no key into onboarding", () => {
    expect(
      resolveStartupRoute({ ...freshUser, hasBeenOpenedBefore: true }),
    ).toBe(ROUTES.ONBOARDING);
  });

  it("sends a fully onboarded user home", () => {
    expect(resolveStartupRoute(onboardedUser)).toBe(ROUTES.HOME);
  });

  it("sends a user with a failing NIP-05 check to the error screen", () => {
    expect(resolveStartupRoute({ ...onboardedUser, nip5Error: true })).toBe(
      ROUTES.ONBOARDING_ERROR,
    );
  });

  describe("guest browsing", () => {
    it("sends a returning guest straight home instead of back into onboarding", () => {
      expect(
        resolveStartupRoute({
          ...freshUser,
          hasBeenOpenedBefore: true,
          isBrowsingAsGuest: true,
        }),
      ).toBe(ROUTES.HOME);
    });

    it("still shows the welcome screen to a guest who has never opened the app", () => {
      expect(
        resolveStartupRoute({ ...freshUser, isBrowsingAsGuest: true }),
      ).toBe(ROUTES.WELCOME);
    });

    it("lets the forceOnboarding dev flag override guest browsing", () => {
      expect(
        resolveStartupRoute({
          ...freshUser,
          hasBeenOpenedBefore: true,
          isBrowsingAsGuest: true,
          forceOnboarding: true,
        }),
      ).toBe(ROUTES.ONBOARDING);
    });

    it("sends a guest who has since completed onboarding home", () => {
      expect(
        resolveStartupRoute({ ...onboardedUser, isBrowsingAsGuest: true }),
      ).toBe(ROUTES.HOME);
    });

    it("does not swallow a NIP-05 error for a guest who has since onboarded", () => {
      expect(
        resolveStartupRoute({
          ...onboardedUser,
          isBrowsingAsGuest: true,
          nip5Error: true,
        }),
      ).toBe(ROUTES.ONBOARDING_ERROR);
    });
  });
});
