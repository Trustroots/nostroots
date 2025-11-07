import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";

import { getCurrentIfDraft } from "@/common/utils";
import { NotificationSubscriptionFilter } from "@/redux/slices/notifications.slice";
import { F } from "@mobily/ts-belt";
import { Draft } from "@reduxjs/toolkit";

import {
  Event,
  eventSchema,
  Filter,
  getFirstLabelValueFromEvent,
  isPlusCodeInsidePlusCode,
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  PlusCode,
} from "@trustroots/nr-common";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import Toast from "react-native-root-toast";
import { z } from "zod";
import { plusCodeToCoordinates } from "./map.utils";

export function removeFilterFromFiltersArray(
  filters: NotificationSubscriptionFilter[],
  targetFilter: NotificationSubscriptionFilter,
) {
  return filters.filter((existingFilterDraft) => {
    const unwrappedDraft = getCurrentIfDraft(existingFilterDraft);
    const isEqual = F.equals(unwrappedDraft, targetFilter);
    return !isEqual;
  });
}

export function addFilterToFiltersArray(
  filters: (
    | NotificationSubscriptionFilter
    | Draft<NotificationSubscriptionFilter>
  )[],
  newFilter: NotificationSubscriptionFilter,
) {
  const filterAlreadyExists = filters.some((existingFilterDraft) => {
    const unwrappedDraft = getCurrentIfDraft(existingFilterDraft);
    const isEqual = F.equals(unwrappedDraft, newFilter);
    return isEqual;
  });
  if (filterAlreadyExists) {
    return filters;
  }
  return filters.concat(newFilter);
}

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
