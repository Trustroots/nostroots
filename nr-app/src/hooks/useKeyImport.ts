import { useState } from "react";
import { nip19 } from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";

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
function parseKeyInput(input: string): KeyImportResult {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error("Please enter a key");
  }

  // Handle nsec format
  if (trimmedInput.startsWith("nsec")) {
    try {
      const decoded = nip19.decode(trimmedInput);
      if (decoded.type === "nsec") {
        const privateKeyHex = bytesToHex(decoded.data);
        return {
          type: "nsec",
          privateKeyHex,
        };
      } else {
        throw new Error("Invalid nsec format");
      }
    } catch (error) {
      throw new Error(
        "That key format does not look right. Check and try again.",
      );
    }
  }

  // Handle mnemonic format
  return {
    type: "mnemonic",
    mnemonic: trimmedInput,
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
