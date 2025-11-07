import {
  getFirstLabelValueFromEvent,
  isPlusCodeInsidePlusCode,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  MAP_NOTE_KIND,
  MAP_NOTE_REPOST_KIND,
  NOTIFICATION_SUBSCRIPTION_KIND,
  TRUSTROOTS_PROFILE_KIND,
} from "@trustroots/nr-common";
import { NostrEvent } from "nostr-tools";

export function isEventForPlusCodeExactly(event: NostrEvent, plusCode: string) {
  const eventPlusCode = getFirstLabelValueFromEvent(
    event,
    OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  );
  return plusCode === eventPlusCode;
}

export function isEventWithinThisPlusCode(event: NostrEvent, plusCode: string) {
  const eventPlusCode = getFirstLabelValueFromEvent(
    event,
    OPEN_LOCATION_CODE_LABEL_NAMESPACE,
  );
  if (typeof eventPlusCode === "undefined") {
    return false;
  }
  const isWithin = isPlusCodeInsidePlusCode(plusCode, eventPlusCode);
  return isWithin;
}

export function getKindName(kind: number): string {
  switch (kind) {
    case TRUSTROOTS_PROFILE_KIND:
      return "Trustroots Profile";
    case NOTIFICATION_SUBSCRIPTION_KIND:
      return "Notification Subscription";
    case MAP_NOTE_KIND:
      return "Map Note";
    case MAP_NOTE_REPOST_KIND:
      return "Map Note Repost";
    default:
      return `Unknown Kind (${kind})`;
  }
}
