import { cn } from "@/utils/cn.utils";
import { View } from "react-native";

export const Section = ({
  children,
  className,
  noGutter,
}: {
  children: React.ReactNode;
  className?: string;
  noGutter?: boolean;
}) => {
  return (
    <View
      className={cn(
        `flex flex-col gap-2`,
        { "my-0": noGutter, "my-2": !noGutter },
        className,
      )}
    >
      {children}
    </View>
  );
};
