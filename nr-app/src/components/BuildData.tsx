import { Text } from "@/components/ui/text";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import React from "react";
import { Platform, View } from "react-native";

// Or using specific imports:
// import { updateId, createdAt, channel, isEmbeddedLaunch } from 'expo-updates';

export default function BuildData() {
  const updateId = Updates.updateId; // The UUID of the update
  const creationTime = Updates.createdAt; // Date object when the update was published
  const updateChannel = Updates.channel; // Channel the update came from (e.g., 'production', 'staging')
  const isEmbedded = Updates.isEmbeddedLaunch; // True if running the build-time embedded code

  // Format the date nicely, only if it exists
  const formattedDate = creationTime
    ? new Date(creationTime).toLocaleString()
    : "N/A";

  return (
    <View className="p-4 my-2 bg-muted border-t border-border">
      <Text className="text-base font-bold mb-2">App Version Info:</Text>
      <View>
        <Text>App Version: {Constants.expoConfig?.version}</Text>
        {Platform.OS === "ios" && (
          <Text>Build Number: {Constants.expoConfig?.ios?.buildNumber}</Text>
        )}
        {Platform.OS === "android" && (
          <Text>
            Version Code: {Constants.expoConfig?.android?.versionCode}
          </Text>
        )}
        <Text>Commit Id: {Constants.expoConfig?.extra?.commitId || "N/A"}</Text>
      </View>

      <Text>Update Information:</Text>
      {isEmbedded ? (
        <Text>Running embedded build (no OTA update applied)</Text>
      ) : (
        <>
          <Text>Update Channel: {updateChannel || "N/A"}</Text>
          <Text>Published: {formattedDate}</Text>
          <Text>Update ID (UUID): {updateId || "N/A"}</Text>
        </>
      )}
    </View>
  );
}
