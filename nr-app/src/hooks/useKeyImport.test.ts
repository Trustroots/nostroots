import { act, renderHook } from "@testing-library/react-native";
import { nip19 } from "nostr-tools";
import { useAppDispatch } from "@/redux/hooks";
import { setPrivateKeyPromiseAction } from "@/redux/sagas/keystore.saga";
import { useKeyImport } from "./useKeyImport";

jest.mock("@/redux/hooks", () => ({
  useAppDispatch: jest.fn(),
}));

describe("useKeyImport", () => {
  const dispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAppDispatch as unknown as jest.Mock).mockReturnValue(dispatch);
    dispatch.mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("imports a validated mnemonic after normalizing case and whitespace", async () => {
    const { result } = renderHook(() => useKeyImport());
    const mnemonic =
      "ABANDON abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    await act(async () => {
      await expect(
        result.current.importKey(`  ${mnemonic}  `),
      ).resolves.toEqual({ success: true, type: "mnemonic" });
    });

    expect(dispatch).toHaveBeenCalledWith(
      setPrivateKeyPromiseAction.request({
        mnemonic:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      }),
    );
    expect(result.current.isImporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("decodes and imports an nsec key", async () => {
    const privateKey = new Uint8Array(32).fill(7);
    const nsec = nip19.nsecEncode(privateKey);
    const { result } = renderHook(() => useKeyImport());

    await act(async () => {
      await expect(result.current.importKey(nsec)).resolves.toEqual({
        success: true,
        type: "nsec",
      });
    });

    expect(dispatch).toHaveBeenCalledWith(
      setPrivateKeyPromiseAction.request({
        privateKeyHex: "07".repeat(32),
      }),
    );
  });

  it("reports empty and malformed key inputs", async () => {
    const { result } = renderHook(() => useKeyImport());

    await act(async () => {
      await expect(result.current.importKey("   ")).resolves.toEqual({
        success: false,
        type: null,
      });
    });
    expect(result.current.error).toBe("Please enter a key");

    await act(async () => {
      await result.current.importKey("nsec-not-valid");
    });
    expect(result.current.error).toBe(
      "That key format does not look right. Check and try again.",
    );

    await act(async () => {
      await result.current.importKey("one two three four");
    });
    expect(result.current.error).toBe(
      "That recovery phrase is not valid. Check the words and their order.",
    );

    await act(async () => {
      await result.current.importKey(
        "npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d",
      );
    });
    expect(result.current.error).toMatch(/public npub/i);
  });

  it("reports storage failures and allows clearing the error", async () => {
    dispatch.mockRejectedValueOnce("storage unavailable");
    const { result } = renderHook(() => useKeyImport());

    await act(async () => {
      await expect(
        result.current.importKey(
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        ),
      ).resolves.toEqual({
        success: false,
        type: null,
      });
    });
    expect(result.current.error).toBe(
      "We could not save this key. Please check and try again.",
    );

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
