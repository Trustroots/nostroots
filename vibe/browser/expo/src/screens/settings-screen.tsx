import * as Clipboard from "expo-clipboard";
import {
  Copy,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  clearPrivateKey,
  getNsecFromSecureStorage,
  getPrivateKeyMnemonicFromSecureStorage,
  getPublicKeyHexFromSecureStorage,
} from "@/nostr/keystore";
import {
  getPermissionEntries,
  revokeOrigin,
} from "@/nostr/permission-store";
import type { Nip7PermissionEntry } from "@/nostr/permission-store";
import { lookupTrustrootsNip05 } from "@/nostr/trustroots-identity";
import { getBuildTimeText } from "@/utils/build-info";
import { nip19 } from "nostr-tools";

interface SettingsScreenProps {
  developerMode: boolean;
  onDeveloperModeChange: (isEnabled: boolean) => void;
  onClose: () => void;
  onKeyCleared: () => void;
}

interface KeyDetails {
  npub: string;
  nsec: string;
  mnemonic: string | null;
}

type TrustrootsNip05State =
  | { status: "loading"; value: null }
  | { status: "loaded"; value: string | null };

const noMnemonicStored =
  "No recovery phrase is stored. This usually means you imported this key as an nsec instead of a recovery phrase.";

export function SettingsScreen({
  developerMode,
  onDeveloperModeChange,
  onClose,
  onKeyCleared,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<KeyDetails | null>(null);
  const [permissionEntries, setPermissionEntries] = useState<
    Nip7PermissionEntry[]
  >([]);
  const [trustrootsNip05, setTrustrootsNip05] =
    useState<TrustrootsNip05State>({
      status: "loading",
      value: null,
    });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const entries = await getPermissionEntries();
    setPermissionEntries(entries);

    try {
      const [publicKeyHex, nsec, mnemonic] = await Promise.all([
        getPublicKeyHexFromSecureStorage(),
        getNsecFromSecureStorage(),
        getPrivateKeyMnemonicFromSecureStorage(),
      ]);
      setDetails({
        npub: nip19.npubEncode(publicKeyHex),
        nsec,
        mnemonic,
      });
      setError("");
      setTrustrootsNip05({ status: "loading", value: null });
      const nip05 = await lookupTrustrootsNip05(publicKeyHex);
      setTrustrootsNip05({ status: "loaded", value: nip05 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load settings.");
      setTrustrootsNip05({ status: "loaded", value: null });
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleRemoveKey = () => {
    Alert.alert(
      "Remove stored key",
      "Remove this key from Nostroots Browser? If you do not have a saved copy of the nsec or recovery phrase somewhere else, you will lose access to this Nostr identity.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove stored key",
          style: "destructive",
          onPress: async () => {
            await clearPrivateKey();
            onClose();
            onKeyCleared();
          },
        },
      ],
    );
  };

  const handleRevoke = async (origin: string) => {
    await revokeOrigin(origin);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 18,
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
          accessibilityLabel="Close settings"
          onPress={onClose}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={26} color="#0f172a" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#0f172a" }}>
            Settings
          </Text>
          <Text style={{ color: "#64748b", fontWeight: "700" }}>
            Nostroots Browser
          </Text>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 14,
          padding: 18,
          paddingBottom: insets.bottom + 28,
        }}
      >
        {!details && !error ? (
          <View style={{ paddingVertical: 80 }}>
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
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}>
              Key
            </Text>
            <KeyValue label="npub" value={details.npub} />
            <KeyValue
              label="Trustroots NIP-05"
              value={
                trustrootsNip05.status === "loading"
                  ? "Looking up on Trustroots relays..."
                  : trustrootsNip05.value ?? "Not found on Trustroots relays"
              }
              disabled={
                trustrootsNip05.status === "loading" || !trustrootsNip05.value
              }
            />
            <KeyValue label="nsec" value={details.nsec} secret />
            <KeyValue
              label="mnemonic"
              value={details.mnemonic ?? noMnemonicStored}
              disabled={!details.mnemonic}
              secret={!!details.mnemonic}
            />
          </>
        ) : null}

        <PermissionsSection
          entries={permissionEntries}
          onRevoke={handleRevoke}
        />

        <View
          style={{
            gap: 14,
            padding: 16,
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
              <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "800" }}>
                Developer mode
              </Text>
              <Text style={{ color: "#64748b", lineHeight: 20 }}>
                Shows an address bar and allows loading other websites.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Developer mode"
              value={developerMode}
              onValueChange={onDeveloperModeChange}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={developerMode ? "#0f766e" : "#ffffff"}
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
            <Text style={{ color: "#475569", fontSize: 13, fontWeight: "800" }}>
              Build time
            </Text>
            <Text
              selectable
              style={{ color: "#64748b", fontVariant: ["tabular-nums"] }}
            >
              {getBuildTimeText()}
            </Text>
          </View>
        </View>

        <View
          style={{
            gap: 10,
            padding: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#fecaca",
            backgroundColor: "#ffffff",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#7f1d1d" }}>
            Remove stored key
          </Text>
          <Text style={{ color: "#64748b", lineHeight: 20 }}>
            This removes the nsec and recovery phrase from Nostroots Browser only.
            If you do not have a saved copy somewhere else, you will lose access
            to this Nostr identity.
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
              flexDirection: "row",
              gap: 8,
              backgroundColor: "#b91c1c",
            }}
          >
            <Trash2 size={18} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontWeight: "800" }}>
              Remove stored key
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function PermissionsSection({
  entries,
  onRevoke,
}: {
  entries: Nip7PermissionEntry[];
  onRevoke: (origin: string) => void;
}) {
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        backgroundColor: "#ffffff",
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "800" }}>
          NIP-07 access
        </Text>
        <Text style={{ color: "#64748b", lineHeight: 20 }}>
          Websites that have used or can use your Nostroots Browser key.
        </Text>
      </View>

      {entries.length === 0 ? (
        <Text style={{ color: "#64748b" }}>No websites have used NIP-07 yet.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {entries.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ShieldCheck
                size={22}
                color={entry.canRevoke ? "#0f766e" : "#64748b"}
              />
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(entry.origin)}
                style={{ flex: 1, gap: 2 }}
              >
                <Text
                  style={{ color: "#0f172a", fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {entry.displayName}
                </Text>
                <Text style={{ color: "#64748b" }}>{entry.detail}</Text>
                <Text
                  style={{ color: "#0f766e", fontSize: 12 }}
                  numberOfLines={1}
                >
                  {entry.origin}
                </Text>
              </Pressable>
              {entry.canRevoke ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove NIP-07 access for ${entry.displayName}`}
                  onPress={() => onRevoke(entry.origin)}
                  style={{
                    width: 38,
                    height: 38,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={18} color="#b91c1c" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
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
        <Text style={{ color: "#475569", fontSize: 13, fontWeight: "800" }}>
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
              {isVisible ? (
                <EyeOff size={20} color="#0f172a" />
              ) : (
                <Eye size={20} color="#0f172a" />
              )}
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
            <Copy size={19} color="#0f172a" />
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
