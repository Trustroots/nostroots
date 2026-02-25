import {
  getPrivateKeyBytesFromSecureStorage,
  getPrivateKeyHexFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { registerForPushNotificationsAsync } from "@/services/notifications.service";
import { getSerializableError } from "@/utils/error.utils";
import { rootLogger } from "@/utils/logger.utils";
import { filterForPlusCode } from "@/utils/notifications.utils";
import { createPromiseActionSaga } from "@/utils/saga.utils";
import {
  create10395EventTemplate,
  kind10395ContentDecryptedDecodedSchema,
  NOTIFICATION_SERVER_PUBKEY,
  NOTIFICATION_SUBSCRIPTION_KIND,
  validate10395EventData,
} from "@trustroots/nr-common";
import { nip04 } from "nostr-tools";
import { AnyAction } from "redux-saga";
import {
  dispatch,
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import { all, call, Effect, put, select, takeEvery } from "redux-saga/effects";
import {
  registerDevicePromiseAction,
  subscribeToPlusCodePromiseAction,
  unregisterDevicePromiseAction,
  unsubscribeFromPlusCodePromiseAction,
} from "../actions/notifications.actions";
import { publishEventTemplatePromiseAction } from "../actions/publish.actions";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import { keystoreSelectors, setPublicKeyHex } from "../slices/keystore.slice";
import {
  notificationsActions,
  notificationSelectors,
  NotificationsState,
} from "../slices/notifications.slice";
import { store } from "../store";

const log = rootLogger.extend("notifications");

const NOTIFICATION_SUBSCRIPTION_SUBSCRIPTION_ID = "notificationSubscription";

async function encryptMessage(plaintext: string) {
  const privateKey = await getPrivateKeyHexFromSecureStorage();
  const encryptedText = nip04.encrypt(
    privateKey,
    NOTIFICATION_SERVER_PUBKEY,
    plaintext,
  );
  return encryptedText;
}

export const [
  sendNotificationSubscriptionEventAction,
  sendNotificationSubscriptionEventSaga,
] = createPromiseActionSaga<NotificationsState | undefined, void>({
  actionTypePrefix: "notifications/sendSubscriptionEvent",
  *effect(action) {
    const notificationData =
      typeof action.payload !== "undefined"
        ? action.payload
        : ((yield select((state) => state.notifications)) as ReturnType<
            typeof store.getState
          >["notifications"]);

    const data = validate10395EventData(notificationData);
    const dataAsJsonString = JSON.stringify(data);

    const encryptedContent = (yield call(
      encryptMessage,
      dataAsJsonString,
    )) as string;

    const eventTemplate = create10395EventTemplate(encryptedContent);

    yield dispatch(
      publishEventTemplatePromiseAction.request({ eventTemplate }),
    );
  },
});

function* registerDeviceSagaEffect(
  action: ReturnType<typeof registerDevicePromiseAction.request>,
): Generator<Effect, void, string | undefined> {
  try {
    log.debug("#rD1vKp registerDeviceSagaEffect()");

    const token = yield call(registerForPushNotificationsAsync);
    if (!token) {
      throw new Error("#vR8tKm Failed to get push token from Expo");
    }

    yield put(notificationsActions.addExpoPushToken(token));
    yield dispatch(sendNotificationSubscriptionEventAction.request());

    log.debug("#rD2wLq Device registered successfully");

    const output = { success: true };
    yield put(registerDevicePromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(registerDevicePromiseAction.failure(serializableError));
    rejectPromiseAction(action, error);
  }
}

function* registerDeviceSaga() {
  yield takeEvery(
    registerDevicePromiseAction.request,
    registerDeviceSagaEffect,
  );
}

function* unregisterDeviceSagaEffect(
  action: ReturnType<typeof unregisterDevicePromiseAction.request>,
): Generator<Effect, void, string | undefined> {
  try {
    log.debug("#uD1vKp unregisterDeviceSagaEffect()");

    const token = yield select(notificationSelectors.selectExpoPushToken);
    if (token) {
      yield put(notificationsActions.removeExpoPushToken(token));
      yield dispatch(sendNotificationSubscriptionEventAction.request());
    }

    log.debug("#uD2wLq Device unregistered successfully");

    const output = { success: true };
    yield put(unregisterDevicePromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(unregisterDevicePromiseAction.failure(serializableError));
    rejectPromiseAction(action, error);
  }
}

function* unregisterDeviceSaga() {
  yield takeEvery(
    unregisterDevicePromiseAction.request,
    unregisterDeviceSagaEffect,
  );
}

function* subscribeToPlusCodeSagaEffect(
  action: ReturnType<typeof subscribeToPlusCodePromiseAction.request>,
): Generator<Effect, void, string | undefined> {
  try {
    log.debug("#sPC1vK subscribeToPlusCodeSagaEffect()");

    // Check if we have a push token, register if not
    let token = yield select(notificationSelectors.selectExpoPushToken);
    if (!token) {
      log.debug("#sPC2wL No push token, registering device first");
      token = yield call(registerForPushNotificationsAsync);

      if (!token) {
        throw new Error("#sPC3xM Failed to get push token");
      }

      yield put(notificationsActions.addExpoPushToken(token));
    }

    // Add filter and sync
    const filter = filterForPlusCode(action.payload.plusCode);
    yield put(notificationsActions.addFilter({ filter }));
    yield dispatch(sendNotificationSubscriptionEventAction.request());

    log.debug("#sPC4yN Subscribed to plus code:", action.payload.plusCode);

    const output = { success: true };
    yield put(subscribeToPlusCodePromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(subscribeToPlusCodePromiseAction.failure(serializableError));
    rejectPromiseAction(action, error);
  }
}

function* subscribeToPlusCodeSaga() {
  yield takeEvery(
    subscribeToPlusCodePromiseAction.request,
    subscribeToPlusCodeSagaEffect,
  );
}

function* unsubscribeFromPlusCodeSagaEffect(
  action: ReturnType<typeof unsubscribeFromPlusCodePromiseAction.request>,
): Generator<Effect, void, void> {
  try {
    log.debug("#uPC1vK unsubscribeFromPlusCodeSagaEffect()");

    const filter = filterForPlusCode(action.payload.plusCode);
    yield put(notificationsActions.removeFilter({ filter }));
    yield dispatch(sendNotificationSubscriptionEventAction.request());

    log.debug("#uPC2wL Unsubscribed from plus code:", action.payload.plusCode);

    const output = { success: true };
    yield put(unsubscribeFromPlusCodePromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(unsubscribeFromPlusCodePromiseAction.failure(serializableError));
    rejectPromiseAction(action, error);
  }
}

function* unsubscribeFromPlusCodeSaga() {
  yield takeEvery(
    unsubscribeFromPlusCodePromiseAction.request,
    unsubscribeFromPlusCodeSagaEffect,
  );
}

function* callGetPrivateKeyBytes(): Generator<
  Effect,
  Awaited<ReturnType<typeof getPrivateKeyBytesFromSecureStorage>>,
  Awaited<ReturnType<typeof getPrivateKeyBytesFromSecureStorage>>
> {
  const privateKey = yield call(getPrivateKeyBytesFromSecureStorage);
  return privateKey;
}

function* callNip04Decrypt(
  privateKey: Uint8Array,
  message: string,
): Generator<
  Effect,
  Awaited<ReturnType<typeof nip04.decrypt>>,
  Awaited<ReturnType<typeof nip04.decrypt>>
> {
  const decrypted = yield call(
    nip04.decrypt,
    privateKey,
    NOTIFICATION_SERVER_PUBKEY,
    message,
  );
  return decrypted;
}

export function* handleIncomingSubscriptionEventEffect(
  action: ReturnType<typeof addEvent>,
) {
  try {
    const privateKey = yield* callGetPrivateKeyBytes();
    const decrypted = yield* callNip04Decrypt(
      privateKey,
      action.payload.event.content,
    );

    const parsed = JSON.parse(decrypted);
    const validated = kind10395ContentDecryptedDecodedSchema.parse(parsed);

    yield put(notificationsActions.setData(validated));
  } catch {
    // If we can't decrypt, silently ignore
  }
}

function isAddEventAction(
  action: AnyAction,
): action is ReturnType<typeof addEvent> {
  return action.type === addEvent.toString();
}

function isAddEventKind10395Action(action: AnyAction): boolean {
  if (!isAddEventAction(action)) {
    return false;
  }
  return action.payload.event.kind === 10395;
}

function* handleIncomingSubscriptionEventSaga() {
  yield takeEvery(
    isAddEventKind10395Action,
    handleIncomingSubscriptionEventEffect,
  );
}

function* startupSagaEffect(): Generator<
  Effect,
  void,
  ReturnType<typeof keystoreSelectors.selectPublicKeyHex>
> {
  const publicKeyHex = yield select(keystoreSelectors.selectPublicKeyHex);

  if (typeof publicKeyHex === "undefined") {
    return;
  }

  yield put(
    startSubscription({
      filters: [
        {
          kinds: [NOTIFICATION_SUBSCRIPTION_KIND],
          authors: [publicKeyHex],
        },
      ],
      id: NOTIFICATION_SUBSCRIPTION_SUBSCRIPTION_ID,
    }),
  );
}

function* startupSaga() {
  yield all([
    takeEvery(rehydrated, startupSagaEffect),
    takeEvery(setPublicKeyHex, startupSagaEffect),
  ]);
}

export default function* notificationsSaga() {
  yield all([
    sendNotificationSubscriptionEventSaga(),
    registerDeviceSaga(),
    unregisterDeviceSaga(),
    subscribeToPlusCodeSaga(),
    unsubscribeFromPlusCodeSaga(),
    handleIncomingSubscriptionEventSaga(),
    startupSaga(),
  ]);
}
