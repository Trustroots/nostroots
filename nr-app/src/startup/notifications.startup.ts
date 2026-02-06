import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";
import { getPlusCodeFromEvent } from "@/utils/event.utils";
import { getLayerForEvent, plusCodeToCoordinates } from "@/utils/map.utils";
import { EventJSONNotificationDataSchema } from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { NostrEvent } from "nostr-tools";
import Toast from "react-native-root-toast";

let lastHandledResponseId: string | null = null;

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

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const responseId = response.notification.request.identifier;
  if (lastHandledResponseId === responseId) {
    return;
  }
  lastHandledResponseId = responseId;
  notificationResponseReceived(response);
}

async function handleInitialNotificationResponse(): Promise<void> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      handleNotificationResponse(response);
    }
  } catch (error) {
    if (__DEV__) {
      console.log("#2t3pWw Failed to read initial notification response", error);
    }
  }
}

export const openEvent = (plusCode: string, event: NostrEvent) => {
  // Dispatch an action to show the correct layer for this event on the map
  const layer = getLayerForEvent(event);
  store.dispatch(mapActions.enableLayer(layer));

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
  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse,
  );
  void handleInitialNotificationResponse();
  return subscription;
}
