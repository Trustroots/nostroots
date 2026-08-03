import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";

import OnboardingTrustrootsScreen from "./trustroots";
import {
  authenticateWithCode,
  NrBridgeError,
  requestVerificationToken,
} from "@/services/nrBridge.service";
import { ensureOnboardingIdentity } from "@/services/onboardingIdentity.service";
import { finalizeTrustrootsProfilePublish } from "@/services/trustrootsProfile.service";

const mockDispatch = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(() => undefined),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
    dismissTo: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

jest.mock("@/services/nrBridge.service", () => {
  const actual = jest.requireActual("@/services/nrBridge.service");
  return {
    ...actual,
    requestVerificationToken: jest.fn(),
    authenticateWithCode: jest.fn(),
  };
});

jest.mock("@/services/onboardingIdentity.service", () => ({
  ensureOnboardingIdentity: jest.fn(),
}));

jest.mock("@/services/trustrootsProfile.service", () => ({
  finalizeTrustrootsProfilePublish: jest.fn(),
}));

const mockRequestVerificationToken = requestVerificationToken as jest.Mock;
const mockAuthenticateWithCode = authenticateWithCode as jest.Mock;
const mockEnsureOnboardingIdentity = ensureOnboardingIdentity as jest.Mock;
const mockFinalize = finalizeTrustrootsProfilePublish as jest.Mock;

async function submitUsername(username = "e2etester") {
  await userEvent.type(
    screen.getByTestId("onboarding-trustroots-username-input"),
    username,
  );
  await userEvent.press(
    screen.getByTestId("onboarding-trustroots-request-code"),
  );
}

async function submitCode(code = "123456") {
  await userEvent.type(
    screen.getByTestId("onboarding-trustroots-code-input"),
    code,
  );
  await userEvent.press(
    screen.getByTestId("onboarding-trustroots-verify-code"),
  );
}

describe("OnboardingTrustrootsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureOnboardingIdentity.mockResolvedValue({
      npub: "npub1test",
      publicKeyHex: "abc",
      wasGenerated: true,
    });
    mockFinalize.mockResolvedValue(undefined);
  });

  it("reports an unknown username as a field error and stays on username entry", async () => {
    mockRequestVerificationToken.mockRejectedValue(
      new NrBridgeError({ code: "not-found", message: "no such user" }),
    );

    render(<OnboardingTrustrootsScreen />);
    await submitUsername();

    await waitFor(() => {
      expect(screen.getByText("Trustroots username not found.")).toBeTruthy();
    });
    expect(screen.queryByTestId("onboarding-trustroots-code-input")).toBeNull();
  });

  it("moves to code entry when a code is already pending", async () => {
    mockRequestVerificationToken.mockRejectedValue(
      new NrBridgeError({ code: "already-pending", message: "pending" }),
    );

    render(<OnboardingTrustrootsScreen />);
    await submitUsername();

    await waitFor(() => {
      expect(
        screen.getByTestId("onboarding-trustroots-code-input"),
      ).toBeTruthy();
    });
    expect(
      screen.getByText(
        "A verification code is already pending. Check your Trustroots email.",
      ),
    ).toBeTruthy();
  });

  it("returns to username entry when the code is rejected", async () => {
    mockRequestVerificationToken.mockResolvedValue(undefined);
    mockAuthenticateWithCode.mockRejectedValue(
      new NrBridgeError({ code: "invalid-or-expired", message: "nope" }),
    );

    render(<OnboardingTrustrootsScreen />);
    await submitUsername();
    await waitFor(() =>
      expect(
        screen.getByTestId("onboarding-trustroots-code-input"),
      ).toBeTruthy(),
    );
    await submitCode();

    await waitFor(() => {
      expect(
        screen.getByText("failed to authenticate you. try again"),
      ).toBeTruthy();
    });
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("offers a retry when the profile publish fails after authentication", async () => {
    mockRequestVerificationToken.mockResolvedValue(undefined);
    mockAuthenticateWithCode.mockResolvedValue(undefined);
    mockFinalize.mockRejectedValue(new Error("relay unreachable"));

    render(<OnboardingTrustrootsScreen />);
    await submitUsername();
    await waitFor(() =>
      expect(
        screen.getByTestId("onboarding-trustroots-code-input"),
      ).toBeTruthy(),
    );
    await submitCode();

    await waitFor(() => {
      expect(screen.getByText("Finish profile setup")).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("navigates to backup confirmation once the profile is published", async () => {
    mockRequestVerificationToken.mockResolvedValue(undefined);
    mockAuthenticateWithCode.mockResolvedValue(undefined);

    render(<OnboardingTrustrootsScreen />);
    await submitUsername();
    await waitFor(() =>
      expect(
        screen.getByTestId("onboarding-trustroots-code-input"),
      ).toBeTruthy(),
    );
    await submitCode();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/onboarding/backup-confirm?from=bridge",
      );
    });
  });
});
