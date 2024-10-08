import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";

export const SLICE_NAME = "relays" as const;

type RelayNotice = {
  message: string;
  receivedAt: number;
};

type Relay = {
  url: string;
  connected: boolean;
  notices: RelayNotice[];
  // TODO: Add relay authentication logic
};

export type Subscription = {
  id: string;
  query: Filter[];
  relaysStatus: {
    [relayUrl: string]: {
      haveSeenEOSE: boolean;
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
  relays: {},
  subscriptions: {},
};

const profileSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    setRelays: (state, action: PayloadAction<{ [id: string]: Relay }>) => {
      state.relays = action.payload;
    },
    setRelayConnected: (state, action: PayloadAction<string>) => {
      const relayUrl = action.payload;
      // TODO Handle missing values more elegantly
      state.relays[relayUrl].connected = true;
    },
    setRelayDisconnected: (state, action: PayloadAction<string>) => {
      const relayUrl = action.payload;
      // TODO Handle missing values more elegantly
      state.relays[relayUrl].connected = false;
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
      state.subscriptions[subscription.id] = subscription;
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
});

export default profileSlice.reducer;
