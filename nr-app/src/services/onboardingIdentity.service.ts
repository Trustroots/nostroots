import type { AppDispatch } from "@/redux/store";
import {
  derivePublicKeyHexFromMnemonic,
  getPublicKeyHexFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { setPublicKeyHex } from "@/redux/slices/keystore.slice";
import { settingsActions } from "@/redux/slices/settings.slice";
import { nip19 } from "nostr-tools";
import { generateSeedWords } from "nip06";

export type OnboardingIdentity = {
  npub: `npub${string}`;
  publicKeyHex: string;
  wasGenerated: boolean;
};

export async function ensureOnboardingIdentity(
  dispatch: AppDispatch,
): Promise<OnboardingIdentity> {
  const storedIdentity = await getPublicKeyHexFromSecureStorage();

  if (storedIdentity) {
    dispatch(
      setPublicKeyHex({
        hasMnemonic: storedIdentity.hasMnemonicInSecureStorage,
        publicKeyHex: storedIdentity.publicKeyHex,
      }),
    );

    return {
      npub: nip19.npubEncode(storedIdentity.publicKeyHex),
      publicKeyHex: storedIdentity.publicKeyHex,
      wasGenerated: false,
    };
  }

  const mnemonic = generateSeedWords().mnemonic;
  const publicKeyHex = derivePublicKeyHexFromMnemonic(mnemonic);

  await dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
  dispatch(settingsActions.setKeyWasImported(false));

  return {
    npub: nip19.npubEncode(publicKeyHex),
    publicKeyHex,
    wasGenerated: true,
  };
}
