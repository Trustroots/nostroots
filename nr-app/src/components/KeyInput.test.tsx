import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";

import { renderWithProviders } from "@/test/render";
import { KeyInput } from "./KeyInput";

describe("KeyInput", () => {
  it("pastes clipboard text", async () => {
    const onChangeText = jest.fn();
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue("pasted secret");

    renderWithProviders(
      <KeyInput value="" onChangeText={onChangeText} showPasteButton />,
    );

    fireEvent.press(screen.getByText("Paste"));

    await waitFor(() => {
      expect(onChangeText).toHaveBeenCalledWith("pasted secret");
    });
  });

  it("copies current value", async () => {
    renderWithProviders(
      <KeyInput value="secret" onChangeText={jest.fn()} showCopyButton />,
    );

    fireEvent.press(screen.getByText("Copy"));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith("secret");
    });
  });

  it("regenerates generated mnemonic values", () => {
    const onChangeText = jest.fn();
    const onRegenerate = jest.fn();

    renderWithProviders(
      <KeyInput
        value="existing"
        onChangeText={onChangeText}
        generateMode
        showRegenerateButton
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.press(screen.getByText("Regenerate"));

    expect(onChangeText).toHaveBeenCalledWith(expect.any(String));
    expect(onRegenerate).toHaveBeenCalledWith(expect.any(String));
  });
});
