import { DEFAULT_RELAY_URL } from "@trustroots/nr-common";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";

type RelayNotice = {
  message: string;
  receivedAt: number;
};

type Relay = {
  url: string;
  // Is this relay one we want to use
  isActive: boolean;
  isConnected: boolean;
  notices: RelayNotice[];
  // TODO: Add relay authentication logic
};

export type Subscription = {
  subscriptionId: string;
  query: Filter[];
  relaysStatus: {
    [relayUrl: string]: {
      hasSeenEOSE: boolean;
      isOpen: boolean;
      serverCloseMessage?: string;
    };
  };
};

export interface RelaysState {
  relays: {
    [relayUrl: string]: Relay;
  };
  subscriptions: {
    [id: string]: Subscription;
  };
}

const initialState: RelaysState = {
  relays: {
    [DEFAULT_RELAY_URL]: {
      url: DEFAULT_RELAY_URL,
      isActive: true,
      isConnected: false,
      notices: [],
    },
  },
  subscriptions: {},
};

export const relaysSlice = createSlice({
  name: "relays",
  initialState,
  reducers: {
    setRelays: (state, action: PayloadAction<{ [id: string]: Relay }>) => {
      state.relays = action.payload;
    },
    setRelayConnected: (state, action: PayloadAction<string>) => {
      const relayUrl = action.payload;
      // TODO Handle missing values more elegantly
      state.relays[relayUrl].isConnected = true;
    },
    setRelayDisconnected: (state, action: PayloadAction<string>) => {
      const relayUrl = action.payload;
      // TODO Handle missing values more elegantly
      state.relays[relayUrl].isConnected = false;
    },
    addRelayNotice: (
      state,
      action: PayloadAction<{
        relayUrl: string;
        notice: RelayNotice;
      }>,
    ) => {
      const { relayUrl, notice } = action.payload;
      state.relays[relayUrl].notices.push(notice);
    },
    setSubscription: (state, action: PayloadAction<Subscription>) => {
      const subscription = action.payload;
      state.subscriptions[subscription.subscriptionId] = subscription;
    },
    setSubscriptionHasSeenEOSE: (
      state,
      action: PayloadAction<{ id: string; relayUrl: string }>,
    ) => {
      const { id, relayUrl } = action.payload;
      const subscription = state.subscriptions[id];
      if (typeof subscription === "undefined") {
        __DEV__ &&
          console.log(
            "Unable to set hasSeenEOSE on invalid subscription ID #AQ4WZB",
          );
      } else {
        const relayStatus = subscription.relaysStatus[relayUrl];
        if (typeof relayStatus === "undefined") {
          __DEV__ &&
            console.log(
              "Unable to set hasSeenEOSE on invalid relay URL #WFAGJN",
            );
        }
        relayStatus.hasSeenEOSE = true;
      }
    },
    setServerClosedMessage: (
      state,
      action: PayloadAction<{
        subscriptionId: string;
        relayUrl: string;
        message: string;
      }>,
    ) => {
      const { subscriptionId, relayUrl, message } = action.payload;
      // TODO Handle missing values more elegantly
      const relayStatus =
        state.subscriptions[subscriptionId].relaysStatus[relayUrl];
      relayStatus.serverCloseMessage = message;
      relayStatus.isOpen = false;
    },
  },
  selectors: {
    getActiveRelayUrls: createSelector(
      (state: RelaysState) => state.relays,
      (relays) =>
        Object.keys(relays).filter((relayUrl) => relays[relayUrl].isActive),
    ),
    selectSubscription: (state, id): Subscription | undefined =>
      state.subscriptions[id],
  },
});

export const {
  setRelays,
  setRelayConnected,
  addRelayNotice,
  setSubscription,
  setSubscriptionHasSeenEOSE,
  setServerClosedMessage,
} = relaysSlice.actions;

export const relaySelectors = relaysSlice.selectors;
