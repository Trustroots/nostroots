import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

export type DiscoveryTab = "feed" | "signals" | "events";

const TABS: { key: DiscoveryTab; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "signals", label: "Signals" },
  { key: "events", label: "Events" },
];

interface DiscoveryTabsProps {
  activeTab: DiscoveryTab;
  onTabChange: (tab: DiscoveryTab) => void;
}

export function DiscoveryTabs({ activeTab, onTabChange }: DiscoveryTabsProps) {
  return (
    <View className="flex-row border-b border-border">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={`flex-1 items-center py-3 ${
              isActive ? "border-b-2 border-primary" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
