import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { StyleSheet, Text } from "react-native";

interface LoadingScreenProps {
  loading: boolean;
  zIndex?: number;
}

// display the loading modal for a min amount of time to avoid flashing
const MIN_LOADING_TIME = 1000;

const LoadingScreen: React.FC<LoadingScreenProps> = ({ loading, zIndex }) => {
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

  const viewStyles = [
    styles.fullScreenView,
    zIndex !== undefined && { zIndex },
  ];

  return (
    <View style={viewStyles}>
      <View style={styles.modalView}>
        <Text style={styles.modalTitle}>Nostroots</Text>
        {shouldDisplay && <Text style={styles.modalText}>loading...</Text>}

        <View style={{ marginTop: 20 }}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    zIndex: 1000,
  },
  modalView: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  modalText: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#2196F3",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default LoadingScreen;
