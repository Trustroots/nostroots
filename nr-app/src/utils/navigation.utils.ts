import { addEvent } from "@/redux/slices/events.slice";
import { mapActions } from "@/redux/slices/map.slice";
import { store } from "@/redux/store";
import { router } from "expo-router";
import { NostrEvent } from "nostr-tools";
import { getLayerForEvent, plusCodeToCoordinates } from "./map.utils";

export function navigateToEvent(plusCode: string, event: NostrEvent) {
  const layer = getLayerForEvent(event);
  store.dispatch(mapActions.enableLayer(layer));
  store.dispatch(addEvent({ event, fromRelay: "notification" }));

  const location = plusCodeToCoordinates(plusCode);

  if (location) {
    store.dispatch(
      mapActions.setCurrentMapLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    );
    store.dispatch(mapActions.setSelectedPlusCode(plusCode));
    store.dispatch(mapActions.centerMapOnHalfModal());
    store.dispatch(
      mapActions.setCurrentNotificationEvent({
        event,
        metadata: { seenOnRelays: [] },
      }),
    );
  }

  router.replace("/");
}
