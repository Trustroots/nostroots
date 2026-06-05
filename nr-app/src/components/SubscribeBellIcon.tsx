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
} from "@/utils/notifications.utils";
import { Bell, BellOff } from "lucide-react-native";
import { Pressable } from "react-native";
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
    const isParentMatch =
      !isExactMatch &&
      filters.some(({ filter }) =>
        doesFilterMatchParentPlusCode(filter, selectedPlusCode),
      );
    return {
      selectedPlusCode,
      subscriptionCount,
      isSubscribed: isExactMatch || isParentMatch,
    };
  },
);

export default function SubscribeBellIcon() {
  const dispatch = useAppDispatch();
  const { selectedPlusCode, subscriptionCount, isSubscribed } = useAppSelector(
    selectSubscriptionState,
  );

  const handlePress = async () => {
    try {
      if (isSubscribed) {
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

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-1.5 p-1"
      accessibilityLabel={
        isSubscribed
          ? "Unsubscribe from notifications"
          : "Subscribe to notifications"
      }
      accessibilityRole="button"
    >
      <Icon
        as={isSubscribed ? Bell : BellOff}
        size={16}
        className={isSubscribed ? "text-primary" : "text-muted-foreground"}
      />
      <Text
        className={`text-xs ${isSubscribed ? "text-primary" : "text-muted-foreground"}`}
      >
        {`${subscriptionCount} people subscribed`}
      </Text>
    </Pressable>
  );
}
