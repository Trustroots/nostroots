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
    (useAppDispatch as jest.Mock).mockReturnValue(dispatch);
    dispatch.mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("imports a mnemonic after trimming whitespace", async () => {
    const { result } = renderHook(() => useKeyImport());

    await act(async () => {
      await expect(
        result.current.importKey("  one two three four  "),
      ).resolves.toEqual({ success: true, type: "mnemonic" });
    });

    expect(dispatch).toHaveBeenCalledWith(
      setPrivateKeyPromiseAction.request({
        mnemonic: "one two three four",
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
  });

  it("reports storage failures and allows clearing the error", async () => {
    dispatch.mockRejectedValueOnce("storage unavailable");
    const { result } = renderHook(() => useKeyImport());

    await act(async () => {
      await expect(result.current.importKey("word list")).resolves.toEqual({
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
