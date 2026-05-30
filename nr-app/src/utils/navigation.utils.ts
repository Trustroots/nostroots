import { ROUTES } from "@/constants/routes";
import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import type { AppDispatch } from "@/redux/store";
import { router } from "expo-router";
import { NostrEvent } from "nostr-tools";
import { getLayerForEvent, plusCodeToCoordinates } from "./map.utils";

let navigationDispatch: AppDispatch | undefined;

export function configureNavigationDispatch(dispatch: AppDispatch) {
  navigationDispatch = dispatch;
}

export function navigateToEvent(plusCode: string, event: NostrEvent) {
  if (!navigationDispatch) {
    if (__DEV__) {
      console.warn("#K7Q9mv Navigation dispatch not configured");
    }
    return;
  }

  const layer = getLayerForEvent(event);
  navigationDispatch(mapActions.enableLayer(layer));
  navigationDispatch(addEvent({ event, fromRelay: "notification" }));

  const location = plusCodeToCoordinates(plusCode);

  if (location) {
    navigationDispatch(
      mapActions.setCurrentMapLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    );
    navigationDispatch(mapActions.setSelectedPlusCode(plusCode));
    navigationDispatch(mapActions.centerMapOnHalfModal());
    navigationDispatch(
      mapActions.setCurrentNotificationEvent({
        event,
        metadata: { seenOnRelays: [] },
      }),
    );
  }

  router.dismissTo(ROUTES.HOME);
}
