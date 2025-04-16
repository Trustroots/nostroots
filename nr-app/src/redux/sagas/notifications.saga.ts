import { getPrivateKeyHex } from "@/nostr/keystore.nostr";
import { getSerializableError } from "@/utils/error.utils";
import { F } from "@mobily/ts-belt";
import {
  create10395EventData,
  create10395EventTemplate,
  NOTIFICATION_SERVER_PUBKEY,
} from "@trustroots/nr-common";
import { nip04 } from "nostr-tools";
import {
  dispatch,
  rejectPromiseAction,
  resolvePromiseAction,
} from "redux-saga-promise-actions";
import { all, call, Effect, put, select, takeEvery } from "redux-saga/effects";
import { createSelector } from "reselect";
import { notificationSubscribeToFilterPromiseAction } from "../actions/notifications.actions";
import { publishEventTemplatePromiseAction } from "../actions/publish.actions";
import { notificationsSlice } from "../slices/notifications.slice";

const notificationsSubscribeSagaEffectSelector = createSelector(
  notificationsSlice.selectors.selectFilters,
  notificationsSlice.selectors.selectExpoPushToken,
  (filters, expoPushToken) => {
    return { filters, expoPushToken };
  },
);

async function encryptMessage(plaintext: string) {
  console.log("#Lrr7Uz getting private key");
  const privateKey = await getPrivateKeyHex();
  console.log("#XQSpLX got private key");
  const encryptedText = nip04.encrypt(
    privateKey,
    NOTIFICATION_SERVER_PUBKEY,
    plaintext,
  );
  console.log("#lLLP9n encrypted", encryptedText);
  return encryptedText;
}

function* notificationsSubscribeSagaEffect(
  action: ReturnType<typeof notificationSubscribeToFilterPromiseAction.request>,
): Generator<
  Effect,
  void,
  | ReturnType<typeof notificationsSubscribeSagaEffectSelector>
  | Awaited<ReturnType<typeof encryptMessage>>
> {
  try {
    const { filter } = action.payload;
    const { filters, expoPushToken } = (yield select(
      notificationsSubscribeSagaEffectSelector,
    )) as ReturnType<typeof notificationsSubscribeSagaEffectSelector>;

    if (typeof expoPushToken === "undefined") {
      throw new Error("#wWpPXH-missing-push-token");
    }

    const isExistingFilter =
      typeof filters.find(F.equals(filter)) !== "undefined";

    if (isExistingFilter) {
      const output = { success: true, message: "duplicate-filter" };
      yield put(notificationSubscribeToFilterPromiseAction.success(output));
      resolvePromiseAction(action, output);
      return;
    }

    const newFilters = filters.concat(filter);

    const data = create10395EventData(expoPushToken, newFilters);
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

export default function* notificationsSaga() {
  yield all([notificationsSubscribeSaga()]);
}
