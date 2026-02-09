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

  // StepCard component
  interface StepCardProps {
    stepNumber: number;
    title: string;
    children: React.ReactNode;
  }

  const StepCard = ({ stepNumber, title, children }: StepCardProps) => (
    <View className="bg-white rounded-xl p-4 w-full gap-3">
      <View className="flex flex-row items-center gap-2">
        <View className="bg-primary rounded w-6 h-6 items-center justify-center">
          <Text className="text-primary-foreground font-bold text-sm">
            {stepNumber}.
          </Text>
        </View>
        <Text className="font-bold text-black">{title}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <>
      <View className="flex items-center gap-6">
        <LinkIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Connect to Trustroots
        </Text>
      </View>

      <Text variant="p">To verify your identity, follow these steps:</Text>

      <View className="flex gap-6 w-full">
        <StepCard stepNumber={1} title="Copy Your Public Key">
          <Text className="text-sm text-gray-600 mb-2 text-left">
            Tap on it to copy it to clipboard.
          </Text>
          <Text
            className="text-sm bg-gray-100 text-black rounded-md p-3 w-full text-left"
            numberOfLines={1}
            onPress={handleCopy}
          >
            {npub || "Nostr key not found on this device."}
          </Text>
        </StepCard>

        <StepCard stepNumber={2} title="Add to Trustroots Profile">
          <Text className="text-sm text-gray-600 mb-2 text-left">
            Log in to Trustroots, then scroll to the bottom of your Networks
            page and paste your public key there.
          </Text>
          <Button onPress={openTrustrootsNetworks} className="w-full">
            <Text>Open Trustroots Networks</Text>
            <SquareArrowOutUpRight size={16} color="white" />
          </Button>
        </StepCard>

        <StepCard stepNumber={3} title="Verify Connection">
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
            className="w-full bg-gray-100 text-black rounded-md p-3 text-sm mb-2 text-left"
          />
          <Button
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
            className="w-full"
          />
        </StepCard>
      </View>

      {linkError && (
        <View className="flex flex-row gap-4 items-center bg-red-700 px-3 py-2 rounded-lg">
          <AlertTriangleIcon color="white" />
          <Text className="text-xs shrink text-white">{linkError}</Text>
        </View>
      )}

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
