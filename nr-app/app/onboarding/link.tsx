import { useRouter } from "expo-router";
import { nip05, nip19 } from "nostr-tools";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { publishEventTemplatePromiseAction } from "@/redux/actions/publish.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { settingsActions } from "@/redux/slices/settings.slice";
import { createKind10390EventTemplate } from "@trustroots/nr-common";
import * as Clipboard from "expo-clipboard";
import {
  AlertTriangleIcon,
  LinkIcon,
  SquareArrowOutUpRight,
} from "lucide-react-native";
import Toast from "react-native-root-toast";

export default function OnboardingLinkScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const npubFromStore = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const publicKeyHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  const hasKeyInStore = useAppSelector(
    keystoreSelectors.selectHasPrivateKeyInSecureStorage,
  );

  const [trustrootsUsername, setTrustrootsUsername] = useState("");
  const [linkStatus, setLinkStatus] = useState<
    "idle" | "verifying" | "linked" | "error"
  >("idle");
  const [linkError, setLinkError] = useState<string | null>(null);

  // Derive npub
  const npub =
    npubFromStore ||
    (publicKeyHex ? nip19.npubEncode(publicKeyHex) : undefined);

  const openTrustrootsNetworks = () => {
    Linking.openURL("https://www.trustroots.org/profile/edit/networks");
  };

  const handleCopy = async () => {
    if (!npub) return;
    try {
      await Clipboard.setStringAsync(npub);
      Toast.show("Copied public key to Clipboard!", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
      });
    } catch (error) {
      console.error("Failed to copy npub to clipboard", error);
    }
  };

  const verifyAndLink = useCallback(
    async (usernameOverride?: string) => {
      if (!npub) {
        setLinkError(
          "We could not read your Nostr key. Please go back and retry.",
        );
        return;
      }

      const normalizedUsername = (
        usernameOverride !== undefined ? usernameOverride : trustrootsUsername
      ).trim();

      if (!normalizedUsername) {
        setLinkError("Enter your Trustroots username to continue.");
        return;
      }

      const identifier = `${normalizedUsername}@trustroots.org`;

      setLinkStatus("verifying");
      setLinkError(null);

      try {
        // NIP-05 lookup: confirm Trustroots identifier maps to this pubkey.
        const profile = await nip05.queryProfile(identifier);

        if (!profile?.pubkey) {
          throw new Error("No pubkey in NIP-05 profile");
        }

        const nip05Npub = nip19.npubEncode(profile.pubkey);

        if (nip05Npub !== npub) {
          throw new Error("NIP-05 npub does not match local key");
        }

        // Build Kind 10390 event using shared helper.
        const eventTemplate = createKind10390EventTemplate(normalizedUsername);

        // NOTE: relay URL should come from configuration; placeholder used here.
        await dispatch(
          publishEventTemplatePromiseAction.request({ eventTemplate }),
        );

        dispatch(settingsActions.setUsername(normalizedUsername));
        setLinkStatus("linked");
      } catch (error) {
        setLinkStatus("error");
        setLinkError(
          "We could not confirm your Trustroots identity via NIP-05 for this key. " +
            "Ensure your Trustroots profile is configured and try again.",
        );
      }
    },
    [dispatch, npub, trustrootsUsername],
  );

  useEffect(() => {
    if (!npub) {
      return;
    }

    const trimmedUsername = trustrootsUsername.trim();
    if (!trimmedUsername || linkStatus !== "idle") {
      return;
    }

    const handler = setTimeout(() => {
      verifyAndLink(trimmedUsername);
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [linkStatus, npub, trustrootsUsername]);

  useEffect(() => {
    handleCopy();
  }, [npub]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.dismissTo("/onboarding/key");
    }
  };

  const goNext = () => {
    router.push("/onboarding/backup-confirm");
  };

  return (
    <>
      <View className="flex items-center gap-6">
        <LinkIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Link With Your Trustroots Account
        </Text>
      </View>

      <Text variant="p">
        Now that you have a private key, we’ll link your public key to your
        Trustroots account so others can verify it’s really you.
      </Text>

      {linkError && (
        <View className="flex flex-row gap-4 items-center bg-red-700 px-3 py-2 rounded-lg">
          <AlertTriangleIcon color="white" />
          <Text className="text-xs shrink text-white">{linkError}</Text>
        </View>
      )}

      <View className="flex gap-6 w-full">
        <View className="flex gap-1 items-start">
          <Text variant="small" className="font-bold">
            Your Nostr Public Key (Click to Copy)
          </Text>
          <Text
            className="text-sm bg-white text-black truncate rounded-md p-2"
            numberOfLines={1}
            onPress={handleCopy}
          >
            {npub || "Nostr key not found on this device."}
          </Text>
        </View>

        <View className="flex gap-2 items-start w-full">
          <Text variant="small" className="font-bold">
            Trustroots Account
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={trustrootsUsername}
            onChangeText={(value) => {
              setTrustrootsUsername(value);
              setLinkError(null);
              setLinkStatus("idle");
            }}
            placeholder="Enter your Trustroots username"
            className="w-full bg-white text-black rounded-md p-2 text-sm"
          />
        </View>
      </View>

      <View className="flex w-full gap-2">
        <Button
          variant="link"
          onPress={openTrustrootsNetworks}
          className="-mr-3"
        >
          <Text className="text-white">Set Up Trustroots Networks</Text>
          <SquareArrowOutUpRight size={16} color="white" />
        </Button>

        <Button
          variant="secondary"
          title={
            linkStatus === "error"
              ? "Try Again"
              : linkStatus === "verifying"
                ? "Verifying via NIP-05..."
                : linkStatus === "linked"
                  ? "Linked"
                  : "Verify"
          }
          disabled={["verifying", "linked"].includes(linkStatus) || !npub}
          onPress={() => verifyAndLink()}
        />
      </View>

      <View className="flex flex-row gap-2">
        <Button
          variant="outline"
          textClassName="text-white"
          onPress={goBack}
          size="lg"
          title="Back"
        />
        <Button
          variant="secondary"
          onPress={goNext}
          size="lg"
          title={"Finish"}
          disabled={linkStatus !== "linked"}
        />
      </View>
    </>
  );
}
