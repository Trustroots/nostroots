import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Filter } from "@trustroots/nr-common";

type NotificationsState = {
  filters: { filter: Filter }[];
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
      state.filters.push({ filter: action.payload });
    },
    removeAllFilters: (state, action: PayloadAction<void>) => {
      state.filters = [];
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
    selectData: (state) => state,
    selectFilters: (state) => state.filters,
    selectTokens: (state) => state.tokens,
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

export const notificationSelectors = notificationsSlice.selectors;

export const notificationsActions = notificationsSlice.actions;
