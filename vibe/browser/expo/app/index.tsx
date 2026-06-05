import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { BrowserScreen } from "@/screens/browser-screen";
import { KeySetupScreen } from "@/screens/key-setup-screen";
import { getHasPrivateKeyInSecureStorage } from "@/nostr/keystore";

export default function IndexRoute() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const refreshKeyState = async (): Promise<void> => {
    const nextHasKey = await getHasPrivateKeyInSecureStorage();
    setHasKey(nextHasKey);
  };

  useEffect(() => {
    let isMounted = true;
    getHasPrivateKeyInSecureStorage().then((nextHasKey) => {
      if (isMounted) {
        setHasKey(nextHasKey);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (hasKey === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <ActivityIndicator color="#12a585" />
      </View>
    );
  }

  return hasKey ? (
    <BrowserScreen onKeyCleared={refreshKeyState} />
  ) : (
    <KeySetupScreen onKeyReady={refreshKeyState} />
  );
}
