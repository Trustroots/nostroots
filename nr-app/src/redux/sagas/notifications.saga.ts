import { getPrivateKeyBytes, getPrivateKeyHex } from "@/nostr/keystore.nostr";
import { getSerializableError } from "@/utils/error.utils";
import { rootLogger } from "@/utils/logger.utils";
import {
  create10395EventTemplate,
  kind10395ContentDecryptedDecodedSchema,
  NOTIFICATION_SERVER_PUBKEY,
  validate10395EventData,
} from "@trustroots/nr-common";
import { nip04 } from "nostr-tools";
import { AnyAction } from "redux-saga";
import {
  dispatch,
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import {
  all,
  call,
  Effect,
  put,
  select,
  take,
  takeEvery,
} from "redux-saga/effects";
import { notificationSubscribeToFilterPromiseAction } from "../actions/notifications.actions";
import { publishEventTemplatePromiseAction } from "../actions/publish.actions";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import {
  notificationsActions,
  notificationSelectors,
  notificationsSlice,
} from "../slices/notifications.slice";

const log = rootLogger.extend("notifications");

const NOTIFICATION_SUBSCRIPTION_SUBSCRIPTION_ID = "notificationSubscription";

async function encryptMessage(plaintext: string) {
  log.debug("#Lrr7Uz getting private key");
  const privateKey = await getPrivateKeyHex();
  log.debug("#XQSpLX got private key");
  const encryptedText = nip04.encrypt(
    privateKey,
    NOTIFICATION_SERVER_PUBKEY,
    plaintext,
  );
  log.debug("#lLLP9n encrypted", encryptedText);
  return encryptedText;
}

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
    const { filter } = action.payload;

    yield put(notificationsActions.addFilter(filter));

    const notificationData = (yield select(
      notificationSelectors.selectData,
    )) as ReturnType<typeof notificationSelectors.selectData>;

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

    yield put(notificationsSlice.actions.addFilter(filter));

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

function* notificationsSubscribeSaga() {
  yield takeEvery(
    notificationSubscribeToFilterPromiseAction.request,
    notificationsSubscribeSagaEffect,
  );
}

function* callGetPrivateKeyBytes(): Generator<
  Effect,
  Awaited<ReturnType<typeof getPrivateKeyBytes>>,
  Awaited<ReturnType<typeof getPrivateKeyBytes>>
> {
  const privateKey = yield call(getPrivateKeyBytes);
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

export function* notificationSubscriptionsStartupSaga(): Generator<
  Effect,
  void,
  void
> {
  yield take(rehydrated);

  yield put(
    startSubscription({
      filters: [],
      id: NOTIFICATION_SUBSCRIPTION_SUBSCRIPTION_ID,
    }),
  );

  // TODO - Get the push token from the device if it is available and set it into state
}

export default function* notificationsSaga() {
  yield all([
    notificationsSubscribeSaga(),
    notificationSubscriptionsStartupSaga(),
  ]);
}
