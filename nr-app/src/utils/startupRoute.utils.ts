import { ROUTES } from "@/constants/routes";

type StartupState = {
  hasBeenOpenedBefore: boolean;
  username: string | null;
  npub: `npub${string}` | undefined;
  nip5Error: boolean;
  isBrowsingAsGuest: boolean;
  forceOnboarding: boolean;
  forceWelcome: boolean;
};

type StartupRoute =
  | typeof ROUTES.WELCOME
  | typeof ROUTES.ONBOARDING
  | typeof ROUTES.ONBOARDING_ERROR
  | typeof ROUTES.HOME;

export function resolveStartupRoute({
  hasBeenOpenedBefore,
  username,
  npub,
  nip5Error,
  isBrowsingAsGuest,
  forceOnboarding,
  forceWelcome,
}: StartupState): StartupRoute {
  if (forceWelcome || !hasBeenOpenedBefore) {
    return ROUTES.WELCOME;
  }

  // A broken identity outranks guest browsing: it means we have a username and
  // npub that Trustroots no longer vouches for, which the user must resolve.
  if (nip5Error) {
    return ROUTES.ONBOARDING_ERROR;
  }

  if (forceOnboarding) {
    return ROUTES.ONBOARDING;
  }

  const hasIdentity = Boolean(username && npub);
  if (hasIdentity || isBrowsingAsGuest) {
    return ROUTES.HOME;
  }

  return ROUTES.ONBOARDING;
}
