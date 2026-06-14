import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { render, RenderOptions } from "@testing-library/react-native";
import React, { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { eventsSlice } from "@/redux/slices/events.slice";
import { keystoreSlice } from "@/redux/slices/keystore.slice";
import { mapSlice } from "@/redux/slices/map.slice";
import { metricsSlice } from "@/redux/slices/metrics.slice";
import { notificationsSlice } from "@/redux/slices/notifications.slice";
import { profilesSlice } from "@/redux/slices/profiles.slice";
import { relaysSlice } from "@/redux/slices/relays.slice";
import { settingsSlice } from "@/redux/slices/settings.slice";

const testRootReducer = combineSlices(
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
export type TestStore = ReturnType<typeof createTestStore>;

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
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  }: RenderOptions & {
    preloadedState?: DeepPartial<TestRootState>;
    store?: TestStore;
  } = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, right: 0, bottom: 34, left: 0 },
          }}
        >
          {children}
        </SafeAreaProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
