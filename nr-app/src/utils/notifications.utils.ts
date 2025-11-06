import {
  eventSchema,
  Filter,
  isPlusCodeInsidePlusCode,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  PlusCode,
} from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import Toast from "react-native-root-toast";
import { z } from "zod";

export function filterForPlusCode(plusCode: PlusCode) {
  const filter: Filter = {
    kinds: [MAP_NOTE_REPOST_KIND],
    authors: [NOSTROOTS_VALIDATION_PUBKEY],
    "#L": [OPEN_LOCATION_CODE_LABEL_NAMESPACE],
    "#l": [plusCode],
  };
  return filter;
}

function hasLabelFilter(
  filter: Filter,
): filter is Filter & { ["#l"]: string[] } {
  const hasLabel = "#l" in filter;
  if (!hasLabel) {
    return false;
  }
  const labelValues = filter["#l"];
  if (!Array.isArray(labelValues)) {
    return false;
  }
  if (
    labelValues.every((label) => typeof label === "string" && label.length > 0)
  ) {
    return true;
  }
  return false;
}

export function doesFilterMatchPlusCodeExactly(
  filter: Filter,
  plusCode: PlusCode,
): boolean {
  if (!hasLabelFilter(filter)) {
    return false;
  }
  const labelValues = filter["#l"];
  const hasMatchForRequiredPlusCode = labelValues.includes(plusCode);
  return hasMatchForRequiredPlusCode;
}

export function doesFilterMatchParentPlusCode(
  filter: Filter,
  plusCode: PlusCode,
): boolean {
  if (!hasLabelFilter(filter)) {
    return false;
  }
  const labelValues = filter["#l"];
  const hasMatchingPlusCode = labelValues.some((label) =>
    isPlusCodeInsidePlusCode(label, plusCode),
  );
  return hasMatchingPlusCode;
}

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
