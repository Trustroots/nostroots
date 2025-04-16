import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";

type NotificationsState = {
  filters: Filter[];
  expoPushTokens: string[];
};

const initialState: NotificationsState = {
  filters: [],
  expoPushTokens: [],
};

export const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addFilter: (state, action: PayloadAction<Filter>) => {
      state.filters.push(action.payload);
    },
    setExpoPushToken: (state, action: PayloadAction<string>) => {
      state.expoPushTokens = [action.payload];
    },
  },
  selectors: {
    selectFilters: (state) => state.filters,
    // We currently assume there is only 1 token, although in theory we could
    // add support for multiple tokens in the future, and the note schema allows
    // for that.
    selectExpoPushToken: (state) => {
      if (state.expoPushTokens.length === 1) {
        return state.expoPushTokens[0];
      }
    },
  },
});

export const notificationsActions = notificationsSlice.actions;
