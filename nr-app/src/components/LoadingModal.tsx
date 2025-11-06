import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text, TextClassContext } from "./ui/text";

interface LoadingScreenProps {
  loading: boolean;
}

// display the loading modal for a min amount of time to avoid flashing
const MIN_LOADING_TIME = 1000;

const LoadingScreen: React.FC<LoadingScreenProps> = ({ loading }) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Start the timer when component mounts
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_TIME);

    return () => clearTimeout(timer);
  }, []);

  const shouldDisplay = loading || !minTimeElapsed;

  if (!shouldDisplay) {
    return null;
  }

  return (
    <View className="absolute inset-0 px-safe-offset-6 justify-center items-center bg-primary z-50 flex flex-col gap-4">
      <TextClassContext.Provider value="text-white text-center">
        <Text variant="h1">Nostroots</Text>

        <ActivityIndicator size="large" color="#fff" />
      </TextClassContext.Provider>
    </View>
  );
};

export default LoadingScreen;
