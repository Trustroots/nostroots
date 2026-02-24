import { View } from "react-native";
import { FileText } from "lucide-react-native";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <Icon as={FileText} size={48} className="text-muted-foreground mb-4" />
      <Text variant="h4" className="text-center">
        {title}
      </Text>
      {description && (
        <Text variant="muted" className="text-center mt-2 px-8">
          {description}
        </Text>
      )}
    </View>
  );
}
