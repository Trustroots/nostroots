import React from "react";

import { View } from "react-native";
import { Button } from "./ui/button";
import { Text } from "./ui/text";

interface WelcomeScreenProps {
  onClose: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onClose }) => {
  return (
    <View className="absolute inset-0 p-safe-offset-6 bg-white flex justify-center items-center gap-6">
      <Text
        variant="h1"
        className="text-3xl font-bold text-gray-900 text-center mb-0"
      >
        Welcome to Nostroots
      </Text>

      <View className="w-1/2 h-1 bg-primary" />

      <View className="flex gap-4 max-w-sm">
        <Text className="text-gray-600 leading-relaxed text-balance text-center">
          Connect with travelers and locals through shared map notes and
          experiences.
        </Text>

        <Text className="text-gray-600 leading-relaxed text-balance text-center">
          Built on Nostr's decentralized network, your data stays in your
          control while connecting with the Trustroots community.
        </Text>

        <Text className="text-gray-600 leading-relaxed text-balance text-center">
          Share locations, tips, and stories without relying on centralized
          platforms.
        </Text>
      </View>

      <View className="w-full max-w-xs">
        <Button
          onPress={onClose}
          title="Get Started"
          size="lg"
          textClassName="uppercase"
        />
      </View>

      <Text variant="muted" className="text-center uppercase text-xs">
        This app is a work in progress.
      </Text>
    </View>
  );
};

export default WelcomeScreen;
