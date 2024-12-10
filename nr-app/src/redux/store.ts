import { combineSlices, configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { promiseMiddleware } from "redux-saga-promise-actions";

import { Platform } from "react-native";
import devtoolsEnhancer from "redux-devtools-expo-dev-plugin";
import rootSaga from "./sagas/root.saga";
import { eventsSlice } from "./slices/events.slice";
import { mapSlice } from "./slices/map.slice";
import { relaysSlice } from "./slices/relays.slice";
import { keystoreSlice } from "./slices/keystore.slice";
import { settingsSlice } from "./slices/settings.slice";

const isOnDevice = Platform.OS !== "web";

const sagaMiddleware = createSagaMiddleware();

const maybeDevToolsEnhancer = isOnDevice ? [devtoolsEnhancer()] : [];

const reducer = combineSlices(
  eventsSlice,
  keystoreSlice,
  mapSlice,
  relaysSlice,
  settingsSlice,
);

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
      serializableCheck: {
        ignoredActionPaths: ["meta.promise"],
      },
    })
      .prepend(promiseMiddleware)
      .concat(sagaMiddleware),
  devTools: !isOnDevice,
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(maybeDevToolsEnhancer),
});

export type AppStore = typeof store;

sagaMiddleware.run(rootSaga);

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
