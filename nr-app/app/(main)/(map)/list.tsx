import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DiscoveryTabs,
  DiscoveryTab,
} from "@/components/discovery/DiscoveryTabs";
import { FeedTab } from "@/components/discovery/FeedTab";
import { SignalsTab } from "@/components/discovery/SignalsTab";
import { EventsTab } from "@/components/discovery/EventsTab";
import { Text } from "@/components/ui/text";

export default function ListScreen() {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("feed");
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-2 pb-1">
        <Text variant="h1">Discover</Text>
      </View>

      {/* Tabs */}
      <DiscoveryTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "feed" && <FeedTab />}
      {activeTab === "signals" && <SignalsTab />}
      {activeTab === "events" && <EventsTab />}
    </View>
  );
}
