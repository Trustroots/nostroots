import { SerializableError } from "@/utils/error.utils";
import { filterForPlusCode } from "@/utils/notifications.utils";
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
  const filter = filterForPlusCode(plusCode);

  return notificationSubscribeToFilterPromiseAction.request({ filter });
};

export const notificationUnsubscribeToFilterPromiseAction = createPromiseAction(
  "notifications/unsubscribe/request",
  "notifications/unsubscribe/success",
  "notifications/unsubscribe/failure",
)<
  { filter: Filter },
  { success: boolean; message?: string },
  SerializableError
>();

export const unsubscribeFromPlusCode = (plusCode: string) => {
  const filter = filterForPlusCode(plusCode);

  return notificationUnsubscribeToFilterPromiseAction.request({ filter });
};
