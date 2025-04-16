import Constants from "expo-constants";
import * as Updates from "expo-updates";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

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
    <View style={styles.container}>
      <Text style={styles.title}>App Version Info:</Text>
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

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    marginVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
});
