import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";
import {
  eventSchema,
  getFirstLabelValueFromEvent,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Event } from "nostr-tools";
import Toast from "react-native-root-toast";
import { z } from "zod";

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
    openEvent(plusCode);
  }
}

export const openEvent = (plusCode: PlusCode) => {
  // store.dispatch(mapActions.enableLayer("trustroots"));
  store.dispatch(mapActions.enableLayer("unverified"));
  store.dispatch(mapActions.setSelectedPlusCode(plusCode));

  // change to the map tab
  router.replace("/");
};

export function setupNotificationHandling() {
  Notifications.addNotificationResponseReceivedListener(
    notificationResponseReceived,
  );
}
