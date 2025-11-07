import { SerializableError } from "@/utils/error.utils";
import { filterForPlusCode } from "@/utils/notifications.utils";
import { createPromiseAction } from "redux-saga-promise-actions";
import { NotificationSubscriptionFilter } from "../slices/notifications.slice";

export const notificationSubscribeToFilterPromiseAction = createPromiseAction(
  "notifications/subscribe/request",
  "notifications/subscribe/success",
  "notifications/subscribe/failure",
)<
  NotificationSubscriptionFilter,
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
  NotificationSubscriptionFilter,
  { success: boolean; message?: string },
  SerializableError
>();

export const unsubscribeFromPlusCode = (plusCode: string) => {
  const filter = filterForPlusCode(plusCode);

  return notificationUnsubscribeToFilterPromiseAction.request({ filter });
};
