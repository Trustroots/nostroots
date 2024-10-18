import { configureStore, StoreEnhancer } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import rootSaga from "./sagas/root.saga";
import {
  SLICE_NAME as eventsName,
  default as eventsReducer,
} from "./slices/events.slice";
import {
  SLICE_NAME as mapName,
  default as mapReducer,
} from "./slices/map.slice";
import {
  SLICE_NAME as relayName,
  default as relayReducer,
} from "./slices/relays.slice";
import devtoolsEnhancer from "redux-devtools-expo-dev-plugin";
import { Platform } from "react-native";

const sagaMiddleware = createSagaMiddleware();

const isOnDevice = Platform.OS !== "web";
console.log("#lPyvNz isOnDevice", isOnDevice);
const devToolsEnhancerOrNot: StoreEnhancer[] = isOnDevice
  ? [devtoolsEnhancer()]
  : [];

export const store = configureStore({
  reducer: {
    [eventsName]: eventsReducer,
    [mapName]: mapReducer,
    [relayName]: relayReducer,
  },
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
