import { createMockRelay, createMockVerifiedEvent } from "@/test/nostrMocks";
import { getRelay } from "./relays.nostr";
import {
  getSubscription,
  injectStore,
  stopSubscription,
  subscribeToFilter,
} from "./subscriptions.nostr";

jest.mock("./relays.nostr", () => ({
  getRelay: jest.fn(),
}));

describe("subscriptions.nostr", () => {
  it("subscribes to filters and forwards relay callbacks to Redux", async () => {
    const event = createMockVerifiedEvent();
    const subscription = { close: jest.fn() };
    const relay = createMockRelay();
    relay.subscribe.mockImplementation((_filters, callbacks) => {
      callbacks.onevent(event);
      callbacks.oneose();
      return subscription;
    });
    (getRelay as jest.Mock).mockResolvedValue(relay);
    const store = { dispatch: jest.fn() };
    injectStore(store as never);

    await expect(
      subscribeToFilter({
        filters: [{ kinds: [1] }],
        relayUrl: "wss://relay.example",
        subscriptionId: "sub-1",
      }),
    ).resolves.toBe("sub-1");

    expect(relay.subscribe).toHaveBeenCalledWith(
      [{ kinds: [1] }],
      expect.objectContaining({ subscriptionId: "sub-1" }),
    );
    expect(store.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { event, fromRelay: "wss://relay.example" },
        type: "events/addEvent",
      }),
    );
    expect(getSubscription("sub-1")).toBe(subscription);
  });

  it("stops subscriptions by id", () => {
    const subscription = getSubscription("sub-1");

    stopSubscription("sub-1");

    expect(subscription.close).toHaveBeenCalled();
  });

  it("does not throw when relay connection fails", async () => {
    (getRelay as jest.Mock).mockRejectedValue(new Error("connection failed"));

    await expect(
      subscribeToFilter({
        filters: [{ kinds: [1] }],
        relayUrl: "ws://10.0.2.2:7777",
        subscriptionId: "sub-failed",
      }),
    ).resolves.toBe("sub-failed");
  });
});
