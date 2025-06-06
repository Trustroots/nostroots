import { SerializableError } from "@/utils/error.utils";
import {
  MAP_NOTE_REPOST_KIND,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
} from "@trustroots/nr-common";
import { Filter } from "nostr-tools";
import { createPromiseAction } from "redux-saga-promise-actions";

export const notificationSubscribeToFilterPromiseAction = createPromiseAction(
  "notifications/subscribe/request",
  "notifications/subscribe/success",
  "notifications/subscribe/failure",
)<
  { filter: Filter },
  { success: boolean; message?: string },
  SerializableError
>();

export const subscribeToPlusCode = (plusCode: string) => {
  const filter: Filter = {
    kinds: [MAP_NOTE_REPOST_KIND],
    "#L": [OPEN_LOCATION_CODE_LABEL_NAMESPACE],
    "#l": [plusCode],
  };

  return notificationSubscribeToFilterPromiseAction.request({ filter });
};
