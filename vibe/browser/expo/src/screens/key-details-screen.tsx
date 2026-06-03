import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { nip19 } from "nostr-tools";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import {
  clearPrivateKey,
  getNsecFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
  getPublicKeyHexFromSecureStorage,
} from "@/nostr/keystore";
import { getBuildTimeText } from "@/utils/build-info";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface KeyDetailsScreenProps {
  isDeveloperModeEnabled: boolean;
  onClose: () => void;
  onDeveloperModeChange: (isEnabled: boolean) => void;
  onKeyCleared: () => void;
}

interface KeyDetails {
  npub: string;
  nsec: string;
  mnemonic: string | null;
}

export function KeyDetailsScreen({
  isDeveloperModeEnabled,
  onClose,
  onDeveloperModeChange,
  onKeyCleared,
}: KeyDetailsScreenProps) {
  const insets = useSafeAreaInsets();
  const buildTimeText = getBuildTimeText();
  const [details, setDetails] = useState<KeyDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        const [publicKeyHex, nsec, mnemonic] = await Promise.all([
          getPublicKeyHexFromSecureStorage(),
          getNsecFromSecureStorage(),
          getPrivateKeyMnemonicFromSecureStorage(),
        ]);

        if (!cancelled) {
          setDetails({
            npub: nip19.npubEncode(publicKeyHex),
            nsec,
            mnemonic,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We could not load this key.",
          );
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemoveKey = () => {
    Alert.alert(
      "Remove key?",
      "This removes the key from Nostroots Browser only. If you do not have this nsec or recovery phrase saved somewhere else, you will lose access to this Nostr identity.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearPrivateKey();
            onKeyCleared();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close key details"
          onPress={onClose}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={28} color="#0f172a" />
        </Pressable>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#0f172a" }}>
            Nostroots Browser
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748b" }}>
            Settings
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onClose}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#0f766e", fontWeight: "700" }}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 14, padding: 18 }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
          Key
        </Text>

        {!details && !error ? (
          <View style={{ paddingTop: 80 }}>
            <ActivityIndicator color="#12a585" />
          </View>
        ) : null}

        {error ? (
          <Text selectable style={{ color: "#b91c1c", fontSize: 16 }}>
            {error}
          </Text>
        ) : null}

        {details ? (
          <>
            <KeyValue label="npub" value={details.npub} />
            <KeyValue label="nsec" value={details.nsec} secret />
            <KeyValue
              label="mnemonic"
              value={
                details.mnemonic ??
                "No recovery phrase is stored. This usually means you imported this key as an nsec instead of a mnemonic."
              }
              disabled={!details.mnemonic}
              secret={!!details.mnemonic}
            />
            <View
              style={{
                gap: 10,
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#fecaca",
                backgroundColor: "#ffffff",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#7f1d1d" }}>
                Remove stored key
              </Text>
              <Text style={{ color: "#64748b", lineHeight: 20 }}>
                This removes the nsec and recovery phrase from Nostroots Browser
                only. If you do not have a copy saved somewhere else, you will
                lose access to this Nostr identity.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove stored key"
                onPress={handleRemoveKey}
                style={{
                  minHeight: 46,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#b91c1c",
                }}
              >
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                  Remove stored key
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <View
          style={{
            gap: 12,
            padding: 14,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#e2e8f0",
            backgroundColor: "#ffffff",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                Developer mode
              </Text>
              <Text style={{ color: "#64748b", lineHeight: 20 }}>
                Shows an address bar and allows loading other websites. Those
                sites can use the native signer while this is on.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Developer mode"
              value={isDeveloperModeEnabled}
              onValueChange={onDeveloperModeChange}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={isDeveloperModeEnabled ? "#0f766e" : "#ffffff"}
            />
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: "#e2e8f0",
              paddingTop: 12,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#475569" }}>
              Build time
            </Text>
            <Text selectable style={{ color: "#64748b", lineHeight: 20 }}>
              {buildTimeText}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function KeyValue({
  label,
  value,
  secret = false,
  disabled = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
  disabled?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(!secret);

  const displayValue = secret && !isVisible ? "••••••••••••••••" : value;

  const handleCopy = async () => {
    if (disabled) return;
    await Clipboard.setStringAsync(value);
  };

  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        backgroundColor: "#ffffff",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ color: "#475569", fontSize: 13, fontWeight: "700" }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {secret ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isVisible ? `Hide ${label}` : `Show ${label}`}
              onPress={() => setIsVisible((value) => !value)}
              disabled={disabled}
              style={{
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Ionicons
                name={isVisible ? "eye-off-outline" : "eye-outline"}
                size={21}
                color="#0f172a"
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ${label}`}
            onPress={handleCopy}
            disabled={disabled}
            style={{
              width: 38,
              height: 38,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Ionicons name="copy-outline" size={20} color="#0f172a" />
          </Pressable>
        </View>
      </View>
      <Text
        selectable
        style={{
          color: disabled ? "#94a3b8" : "#0f172a",
          fontSize: 15,
          lineHeight: 22,
          fontFamily: "Courier",
        }}
      >
        {displayValue}
      </Text>
    </View>
  );
}
