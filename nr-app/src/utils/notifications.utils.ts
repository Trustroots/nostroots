import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";
import {
  Event,
  eventSchema,
  getFirstLabelValueFromEvent,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import Toast from "react-native-root-toast";
import { z } from "zod";
import { plusCodeToCoordinates } from "./map.utils";

const EventNotificationSchema = z.object({
  type: z.literal("event"),
  event: eventSchema,
});

function notificationResponseReceived(
  response: Notifications.NotificationResponse,
): void {
  const notificationData = response.notification.request.content.data;

  const parseResult = EventNotificationSchema.safeParse(notificationData);

  if (!parseResult.success) {
    // TODO Figure out how to log errors here
    Toast.show(
      `Unknown notification payload received #aiylbx\n${JSON.stringify(notificationData)}`,
      {
        duration: Toast.durations.LONG,
      },
    );
    return;
  }

  const data: { type: "event"; event: Event } = parseResult.data;

  if (data.type !== "event") {
    // TODO Figure out how to log unknown event payload type
    Toast.show(
      `Unknown type of notification received #JFs4uH\n${JSON.stringify(notificationData)}`,
      {
        duration: Toast.durations.LONG,
      },
    );
    return;
  }

  const event = parseResult.data.event;

  // TODO Figure out how to take the user to this event
  Toast.show(`Notification response for event ID ${event.id}`, {
    duration: Toast.durations.LONG,
  });

  const plusCode =
    event.tags &&
    Array.isArray(event.tags) &&
    getFirstLabelValueFromEvent(event, OPEN_LOCATION_CODE_LABEL_NAMESPACE);

  if (plusCode) {
    openEvent(plusCode, event);
  }
}

export const openEvent = (plusCode: string, event: Event) => {
  console.log("#jU7fIj Event", event);

  // Disptach an action to show the unverified layer on the map
  store.dispatch(mapActions.enableLayer("unverified"));

  // a layer to the map.
  if (event.kind === 30398) {
    store.dispatch(addEvent({ event, fromRelay: "notification" }));
  }

  store.dispatch(
    mapActions.openHalfMapEventModal({ event, metadata: { seenOnRelays: [] } }),
  );

  const location = plusCodeToCoordinates(plusCode);

  if (location) {
    // use the pluscode location to center the map
    store.dispatch(
      mapActions.setCurrentMapLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    );
    store.dispatch(mapActions.centerMapOnHalfModal());
  }

  // change to the map tab
  router.replace("/");
};

export function setupNotificationHandling() {
  Notifications.addNotificationResponseReceivedListener(
    notificationResponseReceived,
  );
}
