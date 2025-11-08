import {
  getPrivateKeyBytesFromSecureStorage,
  getPrivateKeyHexFromSecureStorage,
} from "@/nostr/keystore.nostr";
import { getSerializableError } from "@/utils/error.utils";
import { rootLogger } from "@/utils/logger.utils";
import {
  addFilterToFiltersArray,
  removeFilterFromFiltersArray,
} from "@/utils/notifications.utils";
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
  notificationSubscribeToFilterPromiseAction,
  notificationUnsubscribeToFilterPromiseAction,
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
  log.debug("#Lrr7Uz getting private key");
  const privateKey = await getPrivateKeyHexFromSecureStorage();
  log.debug("#XQSpLX got private key");
  const encryptedText = nip04.encrypt(
    privateKey,
    NOTIFICATION_SERVER_PUBKEY,
    plaintext,
  );
  log.debug("#lLLP9n encrypted", encryptedText);
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

    if (notificationData.tokens.length === 0) {
      throw new Error("#wWpPXH-missing-push-token");
    }

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

function* notificationsSubscribeSagaEffect(
  action: ReturnType<typeof notificationSubscribeToFilterPromiseAction.request>,
): Generator<
  Effect,
  void,
  | ReturnType<typeof notificationSelectors.selectData>
  | Awaited<ReturnType<typeof encryptMessage>>
> {
  try {
    log.debug("#ChMVeW notificationsSubscribeSagaEffect()*");

    const originalNotificationData = (yield select(
      notificationSelectors.selectData,
    )) as ReturnType<typeof notificationSelectors.selectData>;

    const updatedFilters = addFilterToFiltersArray(
      originalNotificationData.filters,
      action.payload,
    );

    const notificationData = {
      ...originalNotificationData,
      filters: updatedFilters,
    };

    yield dispatch(
      sendNotificationSubscriptionEventAction.request(notificationData),
    );

    // Now that the event has published, remove the filter from redux
    yield put(notificationsActions.addFilter(action.payload));

    const output = { success: true };
    yield put(notificationSubscribeToFilterPromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(
      notificationSubscribeToFilterPromiseAction.failure(serializableError),
    );
    rejectPromiseAction(action, error);
  }
}

function* notificationsUnsubscribeSaga() {
  yield takeEvery(
    notificationUnsubscribeToFilterPromiseAction.request,
    notificationsUnsubscribeSagaEffect,
  );
}

function* notificationsUnsubscribeSagaEffect(
  action: ReturnType<
    typeof notificationUnsubscribeToFilterPromiseAction.request
  >,
): Generator<
  Effect,
  void,
  | ReturnType<typeof notificationSelectors.selectData>
  | Awaited<ReturnType<typeof encryptMessage>>
> {
  try {
    log.debug("#J3njd0 notificationsUnsubscribeSagaEffect()*");

    const originalNotificationData = (yield select(
      notificationSelectors.selectData,
    )) as ReturnType<typeof notificationSelectors.selectData>;

    const updatedFilters = removeFilterFromFiltersArray(
      originalNotificationData.filters,
      action.payload,
    );

    const notificationData = {
      ...originalNotificationData,
      filters: updatedFilters,
    };

    yield dispatch(
      sendNotificationSubscriptionEventAction.request(notificationData),
    );

    yield put(notificationsActions.removeFilter(action.payload));

    const output = { success: true };
    yield put(notificationUnsubscribeToFilterPromiseAction.success(output));
    resolvePromiseAction(action, output);
  } catch (error) {
    const serializableError = getSerializableError(error);
    yield put(
      notificationUnsubscribeToFilterPromiseAction.failure(serializableError),
    );
    rejectPromiseAction(action, error);
  }
}

function* notificationsSubscribeSaga() {
  yield takeEvery(
    notificationSubscribeToFilterPromiseAction.request,
    notificationsSubscribeSagaEffect,
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

export function* notificationSubscriptionsAddEventSagaEffect(
  action: ReturnType<typeof addEvent>,
) {
  const privateKey = yield* callGetPrivateKeyBytes();
  const decrypted = yield* callNip04Decrypt(
    privateKey,
    action.payload.event.content,
  );

  const parsed = JSON.parse(decrypted);

  const validated = kind10395ContentDecryptedDecodedSchema.parse(parsed);

  yield put(notificationsActions.setData(validated));
}

export function isAddEventAction(
  action: AnyAction,
): action is ReturnType<typeof addEvent> {
  return action.type === addEvent.toString();
}

export function isAddEventKind10395Action(action: AnyAction): boolean {
  if (!isAddEventAction(action)) {
    return false;
  }

  if (action.payload.event.kind !== 10395) {
    return false;
  }

  return true;
}

export function* notificationSubscriptionsAddEventSaga() {
  yield takeEvery(
    isAddEventKind10395Action,
    notificationSubscriptionsAddEventSagaEffect,
  );
}

export function* notificationSubscriptionsStartupSagaEffect(): Generator<
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

export function* notificationSubscriptionsStartupSaga() {
  yield all([
    takeEvery(rehydrated, notificationSubscriptionsStartupSagaEffect),
    takeEvery(setPublicKeyHex, notificationSubscriptionsStartupSagaEffect),
  ]);
}

export default function* notificationsSaga() {
  yield all([
    sendNotificationSubscriptionEventSaga(),
    notificationsSubscribeSaga(),
    notificationsUnsubscribeSaga(),
    notificationSubscriptionsAddEventSaga(),
    notificationSubscriptionsStartupSaga(),
  ]);
}
