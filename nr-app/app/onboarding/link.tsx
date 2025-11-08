import { useRouter } from "expo-router";
import { nip05, nip19 } from "nostr-tools";
import React, { useEffect, useState } from "react";
import { Linking, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { signEventTemplate } from "@/nostr/keystore.nostr";
import { publishVerifiedEventToRelay } from "@/nostr/publish.nostr";
import { useAppSelector } from "@/redux/hooks";
import { keystoreSelectors } from "@/redux/slices/keystore.slice";
import { createKind10390EventTemplate } from "@trustroots/nr-common";
import { LinkIcon } from "lucide-react-native";

export default function OnboardingLinkScreen() {
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

  // If somehow no key is present, send user back to key setup.
  useEffect(() => {
    // if (!hasKeyInStore || !npub) {
    //   // Hard guard; ensures "after key step, device must have private key".
    //   router.replace("/onboarding/key");
    // }
  }, [hasKeyInStore, npub, router]);

  const goToApp = () => {
    router.replace("/(tabs)");
  };

  const openTrustrootsNetworks = () => {
    Linking.openURL("https://www.trustroots.org/networks");
  };

  const verifyAndLink = async () => {
    if (!npub) {
      setLinkError(
        "We could not read your Nostr key. Please go back and retry.",
      );
      return;
    }

    const trimmedUsername = trustrootsUsername.trim();
    if (!trimmedUsername) {
      setLinkError("Enter your Trustroots username to continue.");
      return;
    }

    const identifier = `${trimmedUsername}@trustroots.org`;

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
      const eventTemplate = createKind10390EventTemplate(trimmedUsername);
      const signedEvent = await signEventTemplate(eventTemplate);

      // NOTE: relay URL should come from configuration; placeholder used here.
      await publishVerifiedEventToRelay(signedEvent, "wss://relay.damus.io");

      setLinkStatus("linked");
    } catch (error) {
      console.error("Link verification or publish failed", error);
      setLinkStatus("error");
      setLinkError(
        "We could not confirm your Trustroots identity via NIP-05 for this key. " +
          "Ensure your Trustroots profile is configured and try again.",
      );
    }
  };

  const goBack = () => {
    router.back();
  };

  const goNext = () => {
    router.replace("/(tabs)");
  };

  return (
    <View className="flex grow flex-col items-center justify-center gap-8 px-6">
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

      <View className="flex gap-6 w-full">
        <View className="flex gap-1 items-start">
          <Text variant="small" className="font-bold">
            Your Nostr Public Key
          </Text>
          <Text
            className="text-sm bg-white text-black truncate rounded-md p-2"
            numberOfLines={1}
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
          textClassName="text-white"
          variant="outline"
          title="Set Up Trustroots Networks"
          onPress={openTrustrootsNetworks}
        />

        <Button
          textClassName="text-white"
          variant="outline"
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
          onPress={verifyAndLink}
        />
      </View>

      {linkError && (
        <Text className="text-xs text-red-500 mt-1">{linkError}</Text>
      )}

      <View className="flex flex-row gap-2">
        {router.canGoBack() && (
          <Button variant="secondary" onPress={goBack} size="lg" title="Back" />
        )}
        <Button
          variant="secondary"
          onPress={goNext}
          size="lg"
          title={"Finish"}
          disabled={linkStatus !== "linked"}
        />
      </View>
    </View>
  );
}
