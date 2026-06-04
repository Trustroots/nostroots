import { useRouter } from "expo-router";
import { nip05, nip19 } from "nostr-tools";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import {
  settingsActions,
  settingsSelectors,
} from "@/redux/slices/settings.slice";
import { publishTrustrootsProfile } from "@/services/trustrootsProfile.service";
import * as Clipboard from "expo-clipboard";
import {
  AlertTriangleIcon,
  LinkIcon,
  SquareArrowOutUpRight,
} from "lucide-react-native";
import Toast from "react-native-root-toast";

interface StepCardProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}

const StepCard = ({ stepNumber, title, children }: StepCardProps) => (
  <View className="bg-card rounded-xl p-4 w-full gap-3">
    <View className="flex flex-row items-center gap-2">
      <View className="bg-primary rounded w-6 h-6 items-center justify-center">
        <Text className="text-primary-foreground font-bold text-sm">
          {stepNumber}.
        </Text>
      </View>
      <Text className="font-bold text-foreground">{title}</Text>
    </View>
    {children}
  </View>
);

export default function OnboardingLinkScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const npubFromStore = useAppSelector(keystoreSelectors.selectPublicKeyNpub);
  const publicKeyHex = useAppSelector(keystoreSelectors.selectPublicKeyHex);
  const keyWasImported = useAppSelector(settingsSelectors.selectKeyWasImported);

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

        await publishTrustrootsProfile(normalizedUsername, dispatch);

        dispatch(settingsActions.setUsername(normalizedUsername));
        setLinkStatus("linked");
      } catch {
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
    if (keyWasImported) {
      router.replace(ROUTES.HOME);
    } else {
      router.push("/onboarding/backup-confirm");
    }
  };

  return (
    <>
      <View className="flex items-center gap-6">
        <LinkIcon size={128} color="#fff" strokeWidth={0.5} />

        <Text variant="h1" className="my-0">
          Verify Your Trustroots Key
        </Text>
      </View>

      <Text variant="p">
        This path checks that your Trustroots profile already points to the key
        saved on this device.
      </Text>

      <View className="flex gap-6 w-full">
        <StepCard stepNumber={1} title="Copy Your Public Key">
          <Text className="text-sm text-muted-foreground mb-2 text-left">
            Tap on it to copy it to clipboard.
          </Text>
          <Text
            testID={TEST_IDS.link.copyPublicKeyButton}
            className="text-sm bg-muted text-foreground rounded-md p-3 w-full text-left"
            numberOfLines={1}
            onPress={handleCopy}
          >
            {npub || "Nostr key not found on this device."}
          </Text>
        </StepCard>

        <StepCard stepNumber={2} title="Add to Trustroots Profile">
          <Text className="text-sm text-muted-foreground mb-2 text-left">
            If this key is not on your Trustroots profile yet, log in to
            Trustroots, scroll to the bottom of your Networks page, and paste it
            there.
          </Text>
          <Button
            testID={TEST_IDS.link.openTrustrootsButton}
            onPress={openTrustrootsNetworks}
            className="w-full"
          >
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
            className="w-full bg-muted text-foreground rounded-md p-3 text-sm mb-2 text-left"
          />
          <Button
            testID={TEST_IDS.link.confirmButton}
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
