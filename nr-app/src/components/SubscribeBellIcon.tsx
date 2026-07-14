import {
  subscribeToPlusCode,
  unsubscribeFromPlusCode,
} from "@/redux/actions/notifications.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { metricsSelectors } from "@/redux/slices/metrics.slice";
import { notificationSelectors } from "@/redux/slices/notifications.slice";
import {
  doesFilterMatchParentPlusCode,
  doesFilterMatchPlusCodeExactly,
  getMatchingParentPlusCode,
} from "@/utils/notifications.utils";
import { Bell, BellOff } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Toast from "react-native-root-toast";
import { createSelector } from "reselect";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";

const selectSubscriptionState = createSelector(
  [
    notificationSelectors.selectFilters,
    mapSelectors.selectSelectedPlusCode,
    (state) =>
      metricsSelectors.selectPushSubscriptionsMetricByPlusCode(
        state,
        mapSelectors.selectSelectedPlusCode(state),
      ),
  ],
  (filters, selectedPlusCode, subscriptionCount) => {
    const isExactMatch = filters.some(({ filter }) =>
      doesFilterMatchPlusCodeExactly(filter, selectedPlusCode),
    );

    let parentPlusCode: string | undefined;
    if (!isExactMatch) {
      for (const { filter } of filters) {
        if (doesFilterMatchParentPlusCode(filter, selectedPlusCode)) {
          parentPlusCode = getMatchingParentPlusCode(filter, selectedPlusCode);
          break;
        }
      }
    }

    return {
      selectedPlusCode,
      subscriptionCount,
      isExactMatch,
      parentPlusCode,
    };
  },
);

export default function SubscribeBellIcon() {
  const dispatch = useAppDispatch();
  const { selectedPlusCode, subscriptionCount, isExactMatch, parentPlusCode } =
    useAppSelector(selectSubscriptionState);

  const isParentSubscribed = !!parentPlusCode;
  const isSubscribed = isExactMatch || isParentSubscribed;

  const handlePress = async () => {
    if (isParentSubscribed) return;

    try {
      if (isExactMatch) {
        await dispatch(unsubscribeFromPlusCode(selectedPlusCode));
        Toast.show("Unsubscribed", {
          duration: Toast.durations.SHORT,
          position: Toast.positions.TOP,
        });
      } else {
        await dispatch(subscribeToPlusCode(selectedPlusCode));
        Toast.show("Subscribed to notifications", {
          duration: Toast.durations.SHORT,
          position: Toast.positions.TOP,
        });
      }
    } catch (error) {
      Toast.show(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        { duration: Toast.durations.LONG, position: Toast.positions.TOP },
      );
    }
  };

  const label = isParentSubscribed
    ? `Subscribed via ${parentPlusCode}`
    : isExactMatch
      ? "Notifications on"
      : "Get notified";

  const accessibilityLabel = isParentSubscribed
    ? `Subscribed to notifications via ${parentPlusCode}`
    : isExactMatch
      ? "Unsubscribe from notifications"
      : "Subscribe to notifications";

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={handlePress}
        disabled={isParentSubscribed}
        className={`flex-row items-center gap-1.5 p-1 ${isParentSubscribed ? "opacity-60" : ""}`}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <Icon
          as={isSubscribed ? Bell : BellOff}
          size={16}
          className={
            isParentSubscribed
              ? "text-muted-foreground"
              : isExactMatch
                ? "text-primary"
                : "text-muted-foreground"
          }
        />
        <Text
          className={`text-xs ${
            isParentSubscribed
              ? "text-muted-foreground"
              : isExactMatch
                ? "text-primary"
                : "text-muted-foreground"
          }`}
        >
          {label}
        </Text>
      </Pressable>
      {subscriptionCount > 0 && (
        <Text className="text-[10px] text-muted-foreground">
          {subscriptionCount} subscribed
        </Text>
      )}
    </View>
  );
}
