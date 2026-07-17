import AsyncStorage from "@react-native-async-storage/async-storage";
import { waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import {
  SECURE_STORE_PRIVATE_KEY_HEX_KEY,
  SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
} from "@/constants";
import { ROUTES } from "@/constants/routes";
import { renderWithProviders } from "@/test/render";
import E2EResetRoute from "../../../../app/e2e/reset";

describe("E2EResetRoute", () => {
  const originalE2E = process.env.EXPO_PUBLIC_E2E;

  beforeEach(() => {
    jest.mocked(AsyncStorage.clear).mockClear();
    jest.mocked(SecureStore.deleteItemAsync).mockClear();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_E2E = originalE2E;
  });

  it("clears local app state and returns to the welcome screen", async () => {
    process.env.EXPO_PUBLIC_E2E = "1";
    await AsyncStorage.setItem("persist:root", "stored-state");

    const { router } = renderWithProviders(<E2EResetRoute />);

    await waitFor(() => {
      expect(AsyncStorage.clear).toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_PRIVATE_KEY_HEX_KEY,
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_PRIVATE_KEY_HEX_MNEMONIC,
      );
      expect(router.replace).toHaveBeenCalledWith(ROUTES.WELCOME);
    });
  });

  it("does not reset storage when E2E hooks are disabled", async () => {
    process.env.EXPO_PUBLIC_E2E = "0";

    const { router } = renderWithProviders(<E2EResetRoute />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/");
    });
    expect(AsyncStorage.clear).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
