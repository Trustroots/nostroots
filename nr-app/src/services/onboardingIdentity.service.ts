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

const LOG_PREFIX = "[nr-app:onboarding:identity]";

export type OnboardingIdentity = {
  npub: `npub${string}`;
  publicKeyHex: string;
  wasGenerated: boolean;
};

export async function ensureOnboardingIdentity(
  dispatch: AppDispatch,
): Promise<OnboardingIdentity> {
  console.log(`${LOG_PREFIX} ensure identity called`);
  const storedIdentity = await getPublicKeyHexFromSecureStorage();

  if (storedIdentity) {
    console.log(`${LOG_PREFIX} stored identity found`, {
      hasMnemonicInSecureStorage: storedIdentity.hasMnemonicInSecureStorage,
      hasPublicKeyHex: !!storedIdentity.publicKeyHex,
    });
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

  console.log(`${LOG_PREFIX} no stored identity found, generating mnemonic`);
  const mnemonic = generateSeedWords().mnemonic;
  const publicKeyHex = derivePublicKeyHexFromMnemonic(mnemonic);

  await dispatch(setPrivateKeyPromiseAction.request({ mnemonic }));
  dispatch(settingsActions.setKeyWasImported(false));
  console.log(`${LOG_PREFIX} generated identity saved`, {
    hasPublicKeyHex: !!publicKeyHex,
  });

  return {
    npub: nip19.npubEncode(publicKeyHex),
    publicKeyHex,
    wasGenerated: true,
  };
}
