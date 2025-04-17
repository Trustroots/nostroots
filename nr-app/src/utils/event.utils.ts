import {
  getFirstLabelValueFromEvent,
  isPlusCodeInsidePlusCode,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
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
  const isWithin = isPlusCodeInsidePlusCode(plusCode, eventPlusCode);
  return isWithin;
}
