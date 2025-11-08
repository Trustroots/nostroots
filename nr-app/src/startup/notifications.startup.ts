import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { plusCodeToCoordinates } from "@/utils/map.utils";
import { EventJSONNotificationDataSchema } from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { NostrEvent } from "nostr-tools";
import Toast from "react-native-root-toast";

function notificationResponseReceived(
  response: Notifications.NotificationResponse,
): void {
  const notificationData = response.notification.request.content.data;

  // NOTE: We currently only use JSON notes, but this will change
  const parseResult =
    EventJSONNotificationDataSchema.safeParse(notificationData);

  if (!parseResult.success) {
    if (__DEV__)
      console.log(
        "#IBadHG Unknown notification payload received",
        parseResult,
        notificationData,
      );

    // TODO Figure out how to log errors here
    Toast.show(
      `Unknown notification payload received #aiylbx\n${JSON.stringify(notificationData)}`,
      {
        duration: Toast.durations.LONG,
      },
    );
    return;
  }

  const event: NostrEvent = JSON.parse(parseResult.data.event);

  const plusCode = getPlusCodeFromEvent(event);

  if (typeof plusCode === "string") {
    openEvent(plusCode, event);
  }
}

export const openEvent = (plusCode: string, event: NostrEvent) => {
  // Disptach an action to show the unverified layer on the map
  store.dispatch(mapActions.enableLayer("unverified"));

  // a layer to the map.
  store.dispatch(addEvent({ event, fromRelay: "notification" }));

  // store.dispatch(
  //   mapActions.openHalfMapEventModal({ event, metadata: { seenOnRelays: [] } }),
  // );

  const location = plusCodeToCoordinates(plusCode);

  if (location) {
    // use the pluscode location to center the map
    store.dispatch(
      mapActions.setCurrentMapLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    );

    // set selectedPlusCode
    store.dispatch(mapActions.setSelectedPlusCode(plusCode));

    store.dispatch(mapActions.centerMapOnHalfModal());

    // set the current notification event here
    store.dispatch(
      mapActions.setCurrentNotificationEvent({
        event,
        metadata: { seenOnRelays: [] },
      }),
    );
  }

  // change to the map tab
  router.replace("/");
};

export function setupNotificationHandling() {
  return Notifications.addNotificationResponseReceivedListener(
    notificationResponseReceived,
  );
}
