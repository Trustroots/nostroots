import { ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

export interface FilterChip {
  key: string;
  label: string;
  emoji?: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function FilterChips({
  chips,
  selectedKey,
  onSelect,
}: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 py-2 gap-2"
    >
      {chips.map((chip) => {
        const isSelected = chip.key === selectedKey;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onSelect(chip.key)}
            className={`px-3 py-1.5 rounded-full border ${
              isSelected ? "bg-primary border-primary" : "bg-card border-border"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isSelected ? "text-primary-foreground" : "text-foreground"
              }`}
            >
              {chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
