import { configureStore } from "@reduxjs/toolkit";

import {
  SLICE_NAME as eventsName,
  default as eventsReducer,
} from "./eventsSlice";

export const store = configureStore({
  reducer: {
    [eventsName]: eventsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
