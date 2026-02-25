import { SerializableError } from "@/utils/error.utils";
import { createPromiseAction } from "redux-saga-promise-actions";

// Device registration
export const registerDevicePromiseAction = createPromiseAction(
  "notifications/registerDevice/request",
  "notifications/registerDevice/success",
  "notifications/registerDevice/failure",
)<void, { success: boolean }, SerializableError>();

export const registerDevice = () => {
  return registerDevicePromiseAction.request();
};

export const unregisterDevicePromiseAction = createPromiseAction(
  "notifications/unregisterDevice/request",
  "notifications/unregisterDevice/success",
  "notifications/unregisterDevice/failure",
)<void, { success: boolean }, SerializableError>();

export const unregisterDevice = () => {
  return unregisterDevicePromiseAction.request();
};

// Plus code subscriptions (auto-registers device if needed)
export const subscribeToPlusCodePromiseAction = createPromiseAction(
  "notifications/subscribeToPlusCode/request",
  "notifications/subscribeToPlusCode/success",
  "notifications/subscribeToPlusCode/failure",
)<{ plusCode: string }, { success: boolean }, SerializableError>();

export const subscribeToPlusCode = (plusCode: string) => {
  return subscribeToPlusCodePromiseAction.request({ plusCode });
};

export const unsubscribeFromPlusCodePromiseAction = createPromiseAction(
  "notifications/unsubscribeFromPlusCode/request",
  "notifications/unsubscribeFromPlusCode/success",
  "notifications/unsubscribeFromPlusCode/failure",
)<{ plusCode: string }, { success: boolean }, SerializableError>();

export const unsubscribeFromPlusCode = (plusCode: string) => {
  return unsubscribeFromPlusCodePromiseAction.request({ plusCode });
};
