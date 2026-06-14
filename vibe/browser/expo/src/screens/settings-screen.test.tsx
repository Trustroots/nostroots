import { render } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { importPrivateKey } from "@/nostr/keystore";
import { lookupTrustrootsNip05 } from "@/nostr/trustroots-identity";
import { SettingsScreen } from "@/screens/settings-screen";

jest.mock("@/nostr/trustroots-identity", () => ({
  lookupTrustrootsNip05: jest.fn(),
}));

const validMnemonic =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function renderSettingsScreen() {
  return render(
    <SettingsScreen
      developerMode={false}
      onDeveloperModeChange={jest.fn()}
      onClose={jest.fn()}
      onKeyCleared={jest.fn()}
    />,
  );
}

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe("SettingsScreen", () => {
  it("shows a found Trustroots NIP-05 in the key section", async () => {
    (lookupTrustrootsNip05 as jest.Mock).mockResolvedValue("alice@trustroots.org");
    await importPrivateKey(validMnemonic);

    const { findByText } = renderSettingsScreen();

    expect(await findByText("Trustroots NIP-05")).toBeTruthy();
    expect(await findByText("alice@trustroots.org")).toBeTruthy();
  });

  it("shows not-found copy when no Trustroots NIP-05 is found", async () => {
    (lookupTrustrootsNip05 as jest.Mock).mockResolvedValue(null);
    await importPrivateKey(validMnemonic);

    const { findByText } = renderSettingsScreen();

    expect(await findByText("Trustroots NIP-05")).toBeTruthy();
    expect(await findByText("Not found on Trustroots relays")).toBeTruthy();
  });
});
