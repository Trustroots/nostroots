import { eventSchema } from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import Toast from "react-native-root-toast";
import { z } from "zod";

const EventNotificationSchema = z.object({
  type: z.literal("event"),
  event: eventSchema,
});

export function setupNotificationHandling() {
  Notifications.addNotificationResponseReceivedListener(
    function notificationResponseReceived(response) {
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

      const data = parseResult.data;

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
    },
  );
}
