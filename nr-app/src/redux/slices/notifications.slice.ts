import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "nostr-tools";

type NotificationsState = {
  filters: Filter[];
  tokens: {
    expoPushToken: string;
  }[];
};

const initialState: NotificationsState = {
  filters: [],
  tokens: [],
};

export const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addFilter: (state, action: PayloadAction<Filter>) => {
      state.filters.push(action.payload);
    },
    setExpoPushToken: (state, action: PayloadAction<string>) => {
      const isNewToken = state.tokens.every(
        ({ expoPushToken }) => action.payload !== expoPushToken,
      );
      if (isNewToken) {
        state.tokens = [{ expoPushToken: action.payload }];
      }
    },
    setData: (
      state,
      action: PayloadAction<Pick<NotificationsState, "filters" | "tokens">>,
    ) => {
      state.filters = action.payload.filters;
      state.tokens = action.payload.tokens;
    },
  },
  selectors: {
    selectFilters: (state) => state.filters,
    // We currently assume there is only 1 token, although in theory we could
    // add support for multiple tokens in the future, and the note schema allows
    // for that.
    selectExpoPushToken: (state) => {
      if (state.tokens.length === 1) {
        return state.tokens[0].expoPushToken;
      }
    },
  },
});

export const notificationsActions = notificationsSlice.actions;
