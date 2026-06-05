import * as Clipboard from "expo-clipboard";
import {
  Eye,
  EyeOff,
  KeyRound,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
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
      setError(
        err instanceof Error
          ? err.message
          : "We could not save this key. Please check and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setError("");
    setIsGenerating(true);
    try {
      await generatePrivateKey();
      onKeyReady();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not create a new key. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        gap: 20,
        paddingHorizontal: 24,
        paddingTop: insets.top + 28,
        paddingBottom: insets.bottom + 28,
        backgroundColor: "#f8fafc",
      }}
    >
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 34, fontWeight: "800", color: "#0f172a" }}>
          Nostroots Browser
        </Text>
        <InfoRow
          icon={<LinkIcon size={22} color="#0f766e" />}
          text="Nostroots rebuilds Trustroots on open protocols, so travelers and hosts keep control of their identity and connections."
        />
        <InfoRow
          icon={<KeyRound size={22} color="#0f766e" />}
          text="This browser helps manage your key. Trustroots cannot access it; it stays on your phone."
        />
        <Text style={{ fontSize: 16, lineHeight: 23, color: "#475569" }}>
          Connect a key to start. To fully use Nostroots, link a Trustroots
          account to this key. New to Trustroots?{" "}
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(TRUSTROOTS_SIGNUP_URL)}
            style={{ color: "#0f766e", fontWeight: "800" }}
          >
            Sign up first.
          </Text>
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
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#0f172a" }}>
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
            <Sparkles size={18} color="#ffffff" />
          )}
          <Text style={{ fontWeight: "800", color: "#ffffff" }}>
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
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#0f172a" }}>
          Import existing key
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#0f172a" }}>
          Private key or recovery phrase
        </Text>
        <View style={{ position: "relative" }}>
          <TextInput
            accessibilityLabel="Private key or recovery phrase"
            value={input}
            onChangeText={(value) => {
              setInput(value);
              setError("");
            }}
            placeholder="nsec... private-key hex, or recovery phrase"
            secureTextEntry={!isShowingKey}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={{
              minHeight: 112,
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
              right: 8,
              top: 8,
              width: 38,
              height: 38,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isShowingKey ? (
              <EyeOff size={22} color="#475569" />
            ) : (
              <Eye size={22} color="#475569" />
            )}
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
            accessibilityLabel="Paste key"
            onPress={handlePaste}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#cbd5e1",
              backgroundColor: "#ffffff",
            }}
          >
            <Text style={{ fontWeight: "700", color: "#0f172a" }}>Paste</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import key"
            onPress={handleImport}
            disabled={isSaving || isGenerating || !input.trim()}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              borderRadius: 8,
              backgroundColor: "#12a585",
              opacity: isSaving || isGenerating || !input.trim() ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <KeyRound size={18} color="#ffffff" />
            )}
            <Text style={{ fontWeight: "800", color: "#ffffff" }}>Import</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        backgroundColor: "#ffffff",
      }}
    >
      <View style={{ width: 24, alignItems: "center" }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 23, color: "#475569" }}>
        {text}
      </Text>
    </View>
  );
}
