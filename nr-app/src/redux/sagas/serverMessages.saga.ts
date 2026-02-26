import { rootLogger } from "@/utils/logger.utils";
import {
  getFirstTagValueFromEvent,
  SERVER_MESSAGE_KIND,
} from "@trustroots/nr-common";
import Toast from "react-native-root-toast";
import { AnyAction } from "redux-saga";
import { all, put, select, take, takeEvery } from "redux-saga/effects";
import { rehydrated } from "../actions/startup.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import { keystoreSelectors } from "../slices/keystore.slice";

const log = rootLogger.extend("serverMessages");

const SERVER_MESSAGE_SUBSCRIPTION_ID = "serverMessageSubscription";

function isServerMessageEvent(action: AnyAction): boolean {
  return (
    addEvent.match(action) && action.payload.event.kind === SERVER_MESSAGE_KIND
  );
}

function* handleServerMessageEffect(action: ReturnType<typeof addEvent>) {
  const { event } = action.payload;
  const publicKeyHex: ReturnType<typeof keystoreSelectors.selectPublicKeyHex> =
    yield select(keystoreSelectors.selectPublicKeyHex);

  const targetPubkey = getFirstTagValueFromEvent(event, "p");
  if (typeof targetPubkey !== "undefined" && targetPubkey !== publicKeyHex) {
    return;
  }

  log.debug("#vE1rKp Received server message:", event.content);

  Toast.show(event.content, {
    duration: Toast.durations.LONG,
    position: Toast.positions.TOP,
  });
}

function* handleServerMessageSaga() {
  yield takeEvery(isServerMessageEvent, handleServerMessageEffect);
}

function* subscribeToServerMessages() {
  yield take(rehydrated);

  yield put(
    startSubscription({
      filters: [
        {
          kinds: [SERVER_MESSAGE_KIND],
        },
      ],
      id: SERVER_MESSAGE_SUBSCRIPTION_ID,
    }),
  );
}

export default function* serverMessagesSaga() {
  yield all([handleServerMessageSaga(), subscribeToServerMessages()]);
}
