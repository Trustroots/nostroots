import { SerializableError } from "@/utils/error.utils";
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
