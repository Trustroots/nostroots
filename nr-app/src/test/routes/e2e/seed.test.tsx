import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";

import E2ESeedRoute from "../../../../app/e2e/seed";
import {
  NrBridgeError,
  requestVerificationToken,
} from "@/services/nrBridge.service";
import { renderWithProviders } from "@/test/test-utils";

jest.mock("@/services/nrBridge.service", () => {
  const actual = jest.requireActual("@/services/nrBridge.service");
  return {
    ...actual,
    requestVerificationToken: jest.fn(async () => undefined),
  };
});

const mockedRequestVerificationToken = jest.mocked(requestVerificationToken);

describe("E2ESeedRoute", () => {
  const originalE2E = process.env.EXPO_PUBLIC_E2E;

  afterEach(() => {
    process.env.EXPO_PUBLIC_E2E = originalE2E;
    mockedRequestVerificationToken.mockReset();
    mockedRequestVerificationToken.mockResolvedValue(undefined);
  });

  it("persists pending verification state for the next app launch", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";

    const { router } = renderWithProviders(<E2ESeedRoute />, {
      searchParams: { scenario: "pending-verify" },
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));

    expect(mockedRequestVerificationToken).toHaveBeenCalledWith("alice");

    expect(await AsyncStorage.getItem("nostroots:e2e:scenario")).toBe(
      "pending-verify",
    );
    const persistedRoot = JSON.parse(
      (await AsyncStorage.getItem("persist:root")) ?? "{}",
    );
    const settings = JSON.parse(persistedRoot.settings ?? "{}");
    expect(settings).toEqual(
      expect.objectContaining({
        hasBeenOpenedBefore: true,
        pendingTrustrootsUsername: "alice",
      }),
    );
  });

  it("continues when a deterministic verification is already pending", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    mockedRequestVerificationToken.mockRejectedValueOnce(
      new NrBridgeError({
        code: "already-pending",
        status: 409,
        message: "Verification already pending",
      }),
    );

    const { router } = renderWithProviders(<E2ESeedRoute />, {
      searchParams: { scenario: "pending-verify" },
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(await AsyncStorage.getItem("persist:root")).not.toBeNull();
  });
});
