import { useRouter } from "expo-router";
import { LifeBuoy } from "lucide-react-native";

import { ROUTES } from "@/constants/routes";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

export function SendDebugInfoButton() {
  const router = useRouter();

  return (
    <Button
      onPress={() => router.push(ROUTES.FEEDBACK)}
      variant="outline"
      className="w-full"
    >
      <Icon as={LifeBuoy} size={16} className="text-foreground" />
      <Text>Contact support</Text>
    </Button>
  );
}
