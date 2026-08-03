import { createMockVerifiedEvent } from "@/test/nostrMocks";
import { filterForPlusCode } from "@/utils/notifications.utils";
import { NOTIFICATION_SERVER_PUBKEY } from "@trustroots/nr-common";
import { nip04 } from "nostr-tools";
import { dispatch } from "redux-saga-promise-actions";
import { call, put } from "redux-saga/effects";
import {
  registerDevicePromiseAction,
  subscribeToPlusCodePromiseAction,
  unregisterDevicePromiseAction,
  unsubscribeFromPlusCodePromiseAction,
} from "../actions/notifications.actions";
import { startSubscription } from "../actions/subscription.actions";
import { addEvent } from "../slices/events.slice";
import {
  notificationsActions,
  notificationSelectors,
} from "../slices/notifications.slice";
import {
  handleIncomingSubscriptionEventEffect,
  isAddEventKind10395Action,
  registerDeviceSagaEffect,
  sendNotificationSubscriptionEventAction,
  startupSagaEffect,
  subscribeToPlusCodeSagaEffect,
  unregisterDeviceSagaEffect,
  unsubscribeFromPlusCodeSagaEffect,
} from "./notifications.saga";
import { getPrivateKeyBytesFromSecureStorage } from "@/nostr/keystore.nostr";
import { registerForPushNotificationsAsync } from "@/services/notifications.service";

const withPromise = <T extends { meta?: unknown }>(action: T) => {
  const promise = { resolve: jest.fn(), reject: jest.fn() };
  (action as any).meta.promise = promise;
  return { action, promise };
};

describe("notifications.saga", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a device and syncs its token", () => {
    const { action, promise } = withPromise(
      registerDevicePromiseAction.request(),
    );
    const generator = registerDeviceSagaEffect(action);

    expect(generator.next().value).toEqual(
      call(registerForPushNotificationsAsync),
    );
    expect(generator.next("ExponentPushToken[test]").value).toEqual(
      put(notificationsActions.addExpoPushToken("ExponentPushToken[test]")),
    );
    expect(generator.next().value).toEqual(
      dispatch(sendNotificationSubscriptionEventAction.request()),
    );
    expect(generator.next().value).toEqual(
      put(registerDevicePromiseAction.success({ success: true })),
    );
    expect(generator.next().done).toBe(true);
    expect(promise.resolve).toHaveBeenCalledWith({ success: true });
  });

  it("rejects registration when Expo does not return a token", () => {
    const { action, promise } = withPromise(
      registerDevicePromiseAction.request(),
    );
    const generator = registerDeviceSagaEffect(action);
    generator.next();

    expect(generator.next(undefined).value).toMatchObject({
      type: "PUT",
      payload: {
        action: {
          type: "notifications/registerDevice/failure",
          payload: { message: "#vR8tKm Failed to get push token from Expo" },
        },
      },
    });
    expect(generator.next().done).toBe(true);
    expect(promise.reject).toHaveBeenCalledWith(expect.any(Error));
  });

  it("unregisters an existing token and also succeeds without one", () => {
    const existing = withPromise(unregisterDevicePromiseAction.request());
    const generator = unregisterDeviceSagaEffect(existing.action);
    expect(generator.next().value).toMatchObject({ type: "SELECT" });
    expect(generator.next("token").value).toEqual(
      put(notificationsActions.removeExpoPushToken("token")),
    );
    expect(generator.next().value).toEqual(
      dispatch(sendNotificationSubscriptionEventAction.request()),
    );
    expect(generator.next().value).toEqual(
      put(unregisterDevicePromiseAction.success({ success: true })),
    );
    expect(generator.next().done).toBe(true);
    expect(existing.promise.resolve).toHaveBeenCalled();

    const missing = withPromise(unregisterDevicePromiseAction.request());
    const withoutToken = unregisterDeviceSagaEffect(missing.action);
    withoutToken.next();
    expect(withoutToken.next(undefined).value).toEqual(
      put(unregisterDevicePromiseAction.success({ success: true })),
    );
  });

  it("subscribes with an existing push token", () => {
    const plusCode = "8FVC0000+";
    const { action, promise } = withPromise(
      subscribeToPlusCodePromiseAction.request({ plusCode }),
    );
    const generator = subscribeToPlusCodeSagaEffect(action);

    expect(generator.next().value).toMatchObject({ type: "SELECT" });
    expect(generator.next("token").value).toEqual(
      put(
        notificationsActions.addFilter({ filter: filterForPlusCode(plusCode) }),
      ),
    );
    expect(generator.next().value).toEqual(
      dispatch(sendNotificationSubscriptionEventAction.request()),
    );
    expect(generator.next().value).toEqual(
      put(subscribeToPlusCodePromiseAction.success({ success: true })),
    );
    expect(generator.next().done).toBe(true);
    expect(promise.resolve).toHaveBeenCalled();
  });

  it("registers a token before subscribing when necessary", () => {
    const plusCode = "8FVC0000+";
    const { action } = withPromise(
      subscribeToPlusCodePromiseAction.request({ plusCode }),
    );
    const generator = subscribeToPlusCodeSagaEffect(action);
    generator.next();

    expect(generator.next(undefined).value).toEqual(
      call(registerForPushNotificationsAsync),
    );
    expect(generator.next("new-token").value).toEqual(
      put(notificationsActions.addExpoPushToken("new-token")),
    );
    expect(generator.next().value).toEqual(
      put(
        notificationsActions.addFilter({ filter: filterForPlusCode(plusCode) }),
      ),
    );
  });

  it("rejects subscriptions when token registration fails", () => {
    const { action, promise } = withPromise(
      subscribeToPlusCodePromiseAction.request({ plusCode: "8FVC0000+" }),
    );
    const generator = subscribeToPlusCodeSagaEffect(action);
    generator.next();
    generator.next(undefined);

    expect(generator.next(undefined).value).toMatchObject({
      payload: {
        action: { type: "notifications/subscribeToPlusCode/failure" },
      },
    });
    expect(generator.next().done).toBe(true);
    expect(promise.reject).toHaveBeenCalledWith(expect.any(Error));
  });

  it("removes a plus-code subscription and syncs it", () => {
    const plusCode = "8FVC0000+";
    const { action, promise } = withPromise(
      unsubscribeFromPlusCodePromiseAction.request({ plusCode }),
    );
    const generator = unsubscribeFromPlusCodeSagaEffect(action);

    expect(generator.next().value).toEqual(
      put(
        notificationsActions.removeFilter({
          filter: filterForPlusCode(plusCode),
        }),
      ),
    );
    expect(generator.next().value).toEqual(
      dispatch(sendNotificationSubscriptionEventAction.request()),
    );
    expect(generator.next().value).toEqual(
      put(unsubscribeFromPlusCodePromiseAction.success({ success: true })),
    );
    expect(generator.next().done).toBe(true);
    expect(promise.resolve).toHaveBeenCalled();
  });

  it("decrypts valid incoming subscription state", () => {
    const event = createMockVerifiedEvent({
      kind: 10395,
      content: "encrypted",
    });
    const generator = handleIncomingSubscriptionEventEffect(
      addEvent({ event, fromRelay: "relay" }),
    );
    const privateKey = new Uint8Array(32).fill(1);

    expect(generator.next().value).toEqual(
      call(getPrivateKeyBytesFromSecureStorage),
    );
    expect(generator.next(privateKey).value).toEqual(
      call(nip04.decrypt, privateKey, NOTIFICATION_SERVER_PUBKEY, "encrypted"),
    );
    expect(
      generator.next(JSON.stringify({ filters: [], tokens: [] })).value,
    ).toEqual(put(notificationsActions.setData({ filters: [], tokens: [] })));
    expect(generator.next().done).toBe(true);
  });

  it("ignores undecryptable subscription state", () => {
    const event = createMockVerifiedEvent({ kind: 10395 });
    const generator = handleIncomingSubscriptionEventEffect(
      addEvent({ event, fromRelay: "relay" }),
    );
    generator.next();

    expect(generator.throw(new Error("decrypt failed")).done).toBe(true);
  });

  it("recognizes subscription events and starts the private subscription", () => {
    expect(
      isAddEventKind10395Action(
        addEvent({
          event: createMockVerifiedEvent({ kind: 10395 }),
          fromRelay: "relay",
        }),
      ),
    ).toBe(true);
    expect(isAddEventKind10395Action({ type: "other" })).toBe(false);

    const missingKey = startupSagaEffect();
    expect(missingKey.next().value).toMatchObject({ type: "SELECT" });
    expect(missingKey.next(undefined).done).toBe(true);

    const withKey = startupSagaEffect();
    withKey.next();
    expect(withKey.next("public-key").value).toEqual(
      put(
        startSubscription({
          filters: [{ kinds: [10395], authors: ["public-key"] }],
          id: "notificationSubscription",
        }),
      ),
    );
    expect(
      notificationSelectors.selectExpoPushToken.unwrapped({
        filters: [],
        tokens: [{ expoPushToken: "token" }],
      }),
    ).toBe("token");
  });
});
