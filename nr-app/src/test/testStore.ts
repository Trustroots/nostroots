import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { promiseMiddleware } from "redux-saga-promise-actions";

import { eventsSlice } from "@/redux/slices/events.slice";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { mapSlice } from "@/redux/slices/map.slice";
import { metricsSlice } from "@/redux/slices/metrics.slice";
import { notificationsSlice } from "@/redux/slices/notifications.slice";
import { profilesSlice } from "@/redux/slices/profiles.slice";
import { relaysSlice } from "@/redux/slices/relays.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";

export const testRootReducer = combineSlices(
  eventsSlice,
  keystoreSlice,
  mapSlice,
  metricsSlice,
  notificationsSlice,
  profilesSlice,
  relaysSlice,
  settingsSlice,
);

export type TestRootState = ReturnType<typeof testRootReducer>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeState<T>(base: T, overrides: DeepPartial<T>): T {
  if (!isRecord(base) || !isRecord(overrides)) {
    return (overrides ?? base) as T;
  }

  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = output[key];
    output[key] =
      isRecord(baseValue) && isRecord(value)
        ? mergeState(baseValue, value)
        : value;
  }
  return output as T;
}

export function createTestStore(
  preloadedState: DeepPartial<TestRootState> = {},
) {
  const initialState = testRootReducer(undefined, { type: "@@test/init" });

  return configureStore({
    reducer: testRootReducer,
    preloadedState: mergeState(initialState, preloadedState),
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
