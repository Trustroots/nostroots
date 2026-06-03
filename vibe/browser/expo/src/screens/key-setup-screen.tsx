import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { generatePrivateKey, importPrivateKey } from "@/nostr/keystore";

const TRUSTROOTS_SIGNUP_URL = "https://www.trustroots.org/signup";

interface KeySetupScreenProps {
  onKeyReady: () => void;
}

export function KeySetupScreen({ onKeyReady }: KeySetupScreenProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [isShowingKey, setIsShowingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handlePaste = async () => {
    const clipboardText = await Clipboard.getStringAsync();
    if (clipboardText) {
      setInput(clipboardText);
      setError("");
    }
  };

  const handleImport = async () => {
    setError("");
    setIsSaving(true);
    try {
      await importPrivateKey(input);
      onKeyReady();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We could not save this key. Please check and try again.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = () => {
    Alert.alert(
      "Create a new key?",
      "This creates a new Nostr identity for Nostroots Browser and stores its recovery phrase on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create key",
          onPress: async () => {
            setError("");
            setIsGenerating(true);
            try {
              await generatePrivateKey();
              onKeyReady();
            } catch (err) {
              const message =
                err instanceof Error
                  ? err.message
                  : "We could not create a new key. Please try again.";
              setError(message);
            } finally {
              setIsGenerating(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        gap: 20,
        paddingHorizontal: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        backgroundColor: "#f8fafc",
      }}
    >
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 34, fontWeight: "700", color: "#0f172a" }}>
          Nostroots Browser
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: "#475569" }}>
          Nostroots rebuilds Trustroots on open protocols so travelers and
          hosts keep control of identity and connections, instead of depending
          on one central service.
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: "#475569" }}>
          The Nostroots browser will help and guide you with managing your key.
          Trustroots will not have access to this key, it is only stored on your
          phone and in Apple Keychain.
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: "#475569" }}>
          Start by connecting a key. To fully use Nostroots at this point, you
          will also need a Trustroots account that we will link to this key. New
          to Trustroots?{" "}
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(TRUSTROOTS_SIGNUP_URL)}
            style={{ color: "#0f766e", fontWeight: "700" }}
          >
            Sign up first.
          </Text>
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: "#475569" }}>
          Choose how to connect your key: import an existing private key, or
          generate a new one below.
        </Text>
      </View>

      <View
        style={{
          gap: 12,
          padding: 16,
          borderRadius: 8,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#e2e8f0",
        }}
      >
        <View style={{ gap: 5 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>
            New key
          </Text>
          <Text style={{ color: "#64748b", lineHeight: 20 }}>
            Make a fresh Nostr identity. The recovery phrase will be available
            in Settings after the key is created.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Generate new key"
          onPress={handleGenerate}
          disabled={isGenerating || isSaving}
          style={{
            minHeight: 50,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            borderRadius: 8,
            backgroundColor: "#12a585",
            opacity: isGenerating || isSaving ? 0.7 : 1,
          }}
        >
          {isGenerating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name="sparkles-outline" size={18} color="#ffffff" />
          )}
          <Text style={{ fontWeight: "700", color: "#ffffff" }}>
            Generate new key
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          gap: 12,
          padding: 16,
          borderRadius: 8,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#e2e8f0",
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>
          Import existing key
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a" }}>
          Private key or mnemonic
        </Text>
        <View style={{ position: "relative" }}>
          <TextInput
            value={input}
            onChangeText={(value) => {
              setInput(value);
              setError("");
            }}
            placeholder="nsec... or mnemonic phrase"
            secureTextEntry={!isShowingKey}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={{
              minHeight: 96,
              padding: 12,
              paddingRight: 48,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: error ? "#dc2626" : "#cbd5e1",
              color: "#0f172a",
              backgroundColor: "#ffffff",
              textAlignVertical: "top",
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isShowingKey ? "Hide key" : "Show key"}
            onPress={() => setIsShowingKey((value) => !value)}
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={isShowingKey ? "eye-off-outline" : "eye-outline"}
              size={22}
              color="#475569"
            />
          </Pressable>
        </View>

        {error ? (
          <Text selectable style={{ color: "#dc2626", lineHeight: 20 }}>
            {error}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePaste}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#cbd5e1",
              backgroundColor: "#ffffff",
            }}
          >
            <Ionicons name="clipboard-outline" size={18} color="#0f172a" />
            <Text style={{ fontWeight: "600", color: "#0f172a" }}>Paste</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleImport}
            disabled={isSaving || isGenerating}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              borderRadius: 8,
              backgroundColor: "#12a585",
              opacity: isSaving || isGenerating ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons name="key-outline" size={18} color="#ffffff" />
            )}
            <Text style={{ fontWeight: "700", color: "#ffffff" }}>Save</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            "Private key storage",
            "Nostroots Browser stores this key in its own iOS keychain entry. It does not read or change keys stored by the Nostroots mobile app.",
          )
        }
      >
        <Text style={{ color: "#0f766e", fontWeight: "600" }}>
          How is this key stored?
        </Text>
      </Pressable>
    </ScrollView>
  );
}
