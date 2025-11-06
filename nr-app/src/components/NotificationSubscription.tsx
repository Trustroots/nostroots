import {
  subscribeToPlusCode,
  unsubscribeFromPlusCode,
} from "@/redux/actions/notifications.actions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import Toast from "react-native-root-toast";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import { createSelector } from "reselect";
import { notificationSelectors } from "@/redux/slices/notifications.slice";
import {
  doesFilterMatchParentPlusCode,
  doesFilterMatchPlusCodeExactly,
} from "@/utils/notifications.utils";

const notificationSubscriptionSelector = createSelector(
  [notificationSelectors.selectFilters, mapSelectors.selectSelectedPlusCode],
  (filters, selectedPlusCode) => {
    const isExactMatch = filters.some(({ filter }) =>
      doesFilterMatchPlusCodeExactly(filter, selectedPlusCode),
    );
    const isParentMatch =
      isExactMatch === false &&
      filters.some(({ filter }) =>
        doesFilterMatchParentPlusCode(filter, selectedPlusCode),
      );
    return { selectedPlusCode, isExactMatch, isParentMatch };
  },
);

export default function NotificationSubscription() {
  const dispatch = useAppDispatch();
  const { selectedPlusCode, isExactMatch, isParentMatch } = useAppSelector(
    notificationSubscriptionSelector,
  );
  const isMatch = isExactMatch || isParentMatch;

  return (
    <>
      <Text variant="h2">Subscribe</Text>
      {isMatch ? null : (
        <>
          <Text>Subscribe to notifications for this plus code.</Text>
          <Button
            title="Subscribe"
            onPress={async () => {
              try {
                await dispatch(subscribeToPlusCode(selectedPlusCode));
                Toast.show("Successfully subscribed", {
                  duration: Toast.durations.LONG,
                });
              } catch (error) {
                Toast.show(`#Y0WER5 Error: ${error}`);
              }
            }}
          />
        </>
      )}
      {!isExactMatch ? null : (
        <>
          <Text>You are subscribed to notifications for this plus code.</Text>
          <Button
            title="Unsubscribe"
            variant="destructive"
            onPress={async () => {
              try {
                await dispatch(unsubscribeFromPlusCode(selectedPlusCode));
                Toast.show("Successfully subscribed", {
                  duration: Toast.durations.LONG,
                });
              } catch (error) {
                Toast.show(`#uT5zsm Error: ${error}`, {
                  duration: Toast.durations.LONG,
                });
              }
            }}
          />
        </>
      )}
      {!isParentMatch ? null : (
        <>
          <Text>You are subscribed to a parent of this plus code.</Text>
        </>
      )}
    </>
  );
}
