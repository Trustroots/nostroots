import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { promiseMiddleware } from "redux-saga-promise-actions";

import { eventsSlice } from "@/redux/slices/events.slice";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { mapSlice } from "@/redux/slices/map.slice";
import { metricsSlice } from "@/redux/slices/metrics.slice";
import { notificationsSlice } from "@/redux/slices/notifications.slice";
import { relaysSlice } from "@/redux/slices/relays.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";

export const testRootReducer = combineSlices(
  eventsSlice,
  keystoreSlice,
  mapSlice,
  metricsSlice,
  notificationsSlice,
  relaysSlice,
  settingsSlice,
);

export type TestRootState = ReturnType<typeof testRootReducer>;

export function createTestStore(preloadedState?: Partial<TestRootState>) {
  return configureStore({
    reducer: testRootReducer,
    preloadedState: preloadedState as TestRootState | undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: true,
        serializableCheck: false,
        immutableCheck: false,
      }).prepend(promiseMiddleware),
    devTools: false,
  });
}

export type TestStore = ReturnType<typeof createTestStore>;
export type TestAppDispatch = TestStore["dispatch"];
