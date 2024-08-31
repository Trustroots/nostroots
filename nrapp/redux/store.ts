import { configureStore } from "@reduxjs/toolkit";

import {
  default as profilesReducer,
  SLICE_NAME as profilesName,
} from "./profilesSlice";

export const store = configureStore({
  reducer: {
    [profilesName]: profilesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
