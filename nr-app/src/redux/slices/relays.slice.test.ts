import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";

import {
  addRelayNotice,
  relaySelectors,
  relaysSlice,
  setRelayConnected,
  setRelays,
  setServerClosedMessage,
  setSubscription,
  setSubscriptionHasSeenEOSE,
} from "./relays.slice";

describe("relays.slice", () => {
  it("selects active relay URLs", () => {
    const state = relaysSlice.reducer(
      relaysSlice.getInitialState(),
      setRelays({
        "wss://active.example": {
          url: "wss://active.example",
          isActive: true,
          isConnected: false,
          notices: [],
        },
        "wss://inactive.example": {
          url: "wss://inactive.example",
          isActive: false,
          isConnected: false,
          notices: [],
        },
      }),
    );

    expect(relaySelectors.getActiveRelayUrls.unwrapped(state)).toEqual([
      "wss://active.example",
    ]);
  });

  it("updates relay connection and notices", () => {
    const connectedState = relaysSlice.reducer(
      relaysSlice.getInitialState(),
      setRelayConnected(DEFAULT_RELAY_URL),
    );
    const noticeState = relaysSlice.reducer(
      connectedState,
      addRelayNotice({
        relayUrl: DEFAULT_RELAY_URL,
        notice: { message: "hello", receivedAt: 1 },
      }),
    );
    const disconnectedState = relaysSlice.reducer(
      noticeState,
      relaysSlice.actions.setRelayDisconnected(DEFAULT_RELAY_URL),
    );

    expect(disconnectedState.relays[DEFAULT_RELAY_URL]).toMatchObject({
      isConnected: false,
      notices: [{ message: "hello", receivedAt: 1 }],
    });
  });

  it("tracks subscription relay status", () => {
    const subscription = {
      subscriptionId: "sub-1",
      query: [{ kinds: [1] }],
      relaysStatus: {
        [DEFAULT_RELAY_URL]: {
          hasSeenEOSE: false,
          isOpen: true,
        },
      },
    };
    const subscribedState = relaysSlice.reducer(
      relaysSlice.getInitialState(),
      setSubscription(subscription),
    );
    const eoseState = relaysSlice.reducer(
      subscribedState,
      setSubscriptionHasSeenEOSE({
        id: "sub-1",
        relayUrl: DEFAULT_RELAY_URL,
      }),
    );
    const closedState = relaysSlice.reducer(
      eoseState,
      setServerClosedMessage({
        message: "closed",
        relayUrl: DEFAULT_RELAY_URL,
        subscriptionId: "sub-1",
      }),
    );

    expect(
      relaySelectors.selectSubscription.unwrapped(closedState, "sub-1"),
    ).toMatchObject({
      relaysStatus: {
        [DEFAULT_RELAY_URL]: {
          hasSeenEOSE: true,
          isOpen: false,
          serverCloseMessage: "closed",
        },
      },
    });
  });
});
