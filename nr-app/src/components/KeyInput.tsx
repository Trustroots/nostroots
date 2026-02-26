import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import * as Clipboard from "expo-clipboard";
import {
  ClipboardPasteIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react-native";
import { useState, useEffect } from "react";
import { TextInput, View, Pressable } from "react-native";
import Toast from "react-native-root-toast";
import { generateSeedWords } from "nip06";

interface KeyInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showRegenerateButton?: boolean;
  generateMode?: boolean;
  onRegenerate?: (newValue: string) => void;
  showCopyButton?: boolean;
  showPasteButton?: boolean;
}

export function KeyInput({
  value,
  onChangeText,
  placeholder = "Paste your nsec key or mnemonic phrase",
  disabled = false,
  showRegenerateButton = false,
  generateMode = false,
  onRegenerate,
  showCopyButton = false,
  showPasteButton = false,
}: KeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  // Generate initial mnemonic if in generate mode
  useEffect(() => {
    if (generateMode && !value) {
      const newMnemonic = generateSeedWords().mnemonic;
      onChangeText(newMnemonic);
    }
  }, [generateMode, value, onChangeText]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(value);
      Toast.show("Copied to Clipboard!", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
      });
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        onChangeText(text);
        Toast.show("Pasted from Clipboard!", {
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM,
        });
      }
    } catch (error) {
      console.error("Failed to paste from clipboard", error);
    }
  };

  const handleRegenerate = () => {
    const newMnemonic = generateSeedWords().mnemonic;
    onChangeText(newMnemonic);
    if (onRegenerate) {
      onRegenerate(newMnemonic);
    }
  };

  return (
    <View className="flex gap-2">
      <View className="relative">
        <TextInput
          secureTextEntry={!showKey}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          className="border border-border rounded-lg p-3 pr-12 text-sm bg-background"
          editable={!disabled}
        />
        <Pressable
          onPress={() => setShowKey(!showKey)}
          disabled={disabled}
          className="absolute right-3 top-3"
        >
          {showKey ? (
            <EyeOffIcon size={20} color="#666" />
          ) : (
            <EyeIcon size={20} color="#666" />
          )}
        </Pressable>
      </View>

      {(showCopyButton || showPasteButton || showRegenerateButton) && (
        <View className="flex flex-row gap-2">
          {showCopyButton && (
            <Button
              className={
                showRegenerateButton && onRegenerate ? "w-1/2" : "flex-1"
              }
              size="sm"
              variant="outline"
              onPress={handleCopy}
              disabled={disabled}
            >
              <CopyIcon size={16} color="#000" />
              <Text className="text-sm">Copy</Text>
            </Button>
          )}
          {showPasteButton && (
            <Button
              className="flex-1"
              size="sm"
              variant="outline"
              onPress={handlePaste}
              disabled={disabled}
            >
              <ClipboardPasteIcon size={16} color="#000" />
              <Text className="text-sm">Paste</Text>
            </Button>
          )}
          {showRegenerateButton ? (
            <Button
              className="flex-1"
              size="sm"
              variant="outline"
              onPress={handleRegenerate}
              disabled={disabled}
            >
              <Text className="text-sm">Regenerate</Text>
            </Button>
          ) : null}
        </View>
      )}
    </View>
  );
}
