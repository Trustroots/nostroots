import { combineSlices, configureStore, StoreEnhancer } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import { Platform } from "react-native";
import devtoolsEnhancer from "redux-devtools-expo-dev-plugin";
import rootSaga from "./sagas/root.saga";
import { eventsSlice } from "./slices/events.slice";
import { mapSlice } from "./slices/map.slice";
import { relaysSlice } from "./slices/relays.slice";

const sagaMiddleware = createSagaMiddleware();

const isOnDevice = Platform.OS !== "web";
const devToolsEnhancerOrNot: StoreEnhancer[] = isOnDevice
  ? [devtoolsEnhancer()]
  : [];

const reducer = combineSlices(eventsSlice, mapSlice, relaysSlice);

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(sagaMiddleware),
  devTools: !isOnDevice,
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(devToolsEnhancerOrNot),
});

export type AppStore = typeof store;

sagaMiddleware.run(rootSaga);

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
