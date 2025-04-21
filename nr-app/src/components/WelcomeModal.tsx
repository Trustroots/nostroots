import React from "react";

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface WelcomeScreenProps {
  visible: boolean;
  onClose: () => void;
  zIndex?: number;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  visible,
  onClose,
  zIndex,
}) => {
  if (!visible) {
    return null;
  }

  const viewStyles = [
    styles.fullScreenView,
    zIndex !== undefined && { zIndex },
  ];

  return (
    <View style={viewStyles}>
      <View style={styles.modalView}>
        <Text style={styles.modalTitle}>Welcome to Nostroots</Text>
        <View>
          <Text style={styles.modalText}>This app is a work in progress.</Text>
          <Text style={styles.modalText}>
            You can add your own map notes, and share them with others.
          </Text>

          <Text style={styles.modalText}>
            This app uses the open-source decentralized Nostr protocol.
          </Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10, // Ensure it appears on top
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

export default WelcomeScreen;
