import { useState } from "react";
import { nip19 } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { validateWords } from "nip06";

type KeyImportResult =
  | {
      type: "nsec";
      privateKeyHex: string;
    }
  | {
      type: "mnemonic";
      mnemonic: string;
    };

/**
 * Parses and validates a key input (nsec or mnemonic)
 * @param input - The raw key input from the user
 * @returns KeyImportResult with the parsed key data
 * @throws Error if the input is invalid
 */
export function parseKeyInput(input: string): KeyImportResult {
  const trimmedInput = input.trim();
  const lowerInput = trimmedInput.toLowerCase();

  if (!trimmedInput) {
    throw new Error("Please enter a key");
  }

  // Handle nsec format
  if (lowerInput.startsWith("npub1")) {
    throw new Error(
      "That is a public npub address. Import your private nsec or recovery phrase instead.",
    );
  }

  if (lowerInput.startsWith("nsec")) {
    try {
      const decoded = nip19.decode(lowerInput);
      // The checked nsec human-readable prefix determines the decoded type.
      const privateKeyHex = bytesToHex(decoded.data as Uint8Array);
      return {
        type: "nsec",
        privateKeyHex,
      };
    } catch (error) {
      throw new Error(
        "That key format does not look right. Check and try again.",
      );
    }
  }

  const mnemonic = lowerInput.split(/\s+/).join(" ");
  if (!validateWords({ mnemonic }).isMnemonicValid) {
    throw new Error(
      "That recovery phrase is not valid. Check the words and their order.",
    );
  }

  return {
    type: "mnemonic",
    mnemonic,
  };
}

export type ImportKeyResult =
  | { success: true; type: "nsec" | "mnemonic" }
  | { success: false; type: null };

export function useKeyImport() {
  const dispatch = useAppDispatch();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importKey = async (input: string): Promise<ImportKeyResult> => {
    setError(null);

    try {
      const result = parseKeyInput(input);

      setIsImporting(true);

      if (result.type === "nsec") {
        await dispatch(
          setPrivateKeyPromiseAction.request({
            privateKeyHex: result.privateKeyHex,
          }),
        );
      } else {
        await dispatch(
          setPrivateKeyPromiseAction.request({
            mnemonic: result.mnemonic,
          }),
        );
      }

      setIsImporting(false);
      return { success: true, type: result.type };
    } catch (err) {
      console.error("Failed to import key", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "We could not save this key. Please check and try again.";
      setError(errorMessage);
      setIsImporting(false);
      return { success: false, type: null };
    }
  };

  return {
    importKey,
    isImporting,
    error,
    clearError: () => setError(null),
  };
}
