import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore, createTransform } from "redux-persist";
import createSagaMiddleware from "redux-saga";
import { promiseMiddleware } from "redux-saga-promise-actions";

import { Platform } from "react-native";
import devtoolsEnhancer from "redux-devtools-expo-dev-plugin";
import { startup } from "./actions/startup.actions";
import rootSaga from "./sagas/root.saga";
import { eventsSlice } from "./slices/events.slice";
import { keystoreSlice } from "./slices/keystore.slice";
import { mapSlice } from "./slices/map.slice";
import { notificationsSlice } from "./slices/notifications.slice";
import { relaysSlice } from "./slices/relays.slice";
import { settingsSlice } from "./slices/settings.slice";

const isOnDevice = Platform.OS !== "web";

const sagaMiddleware = createSagaMiddleware();

const maybeDevToolsEnhancer = isOnDevice
  ? [devtoolsEnhancer({ maxAge: 200 })]
  : [];

const rootReducer = combineSlices(
  eventsSlice,
  keystoreSlice,
  mapSlice,
  notificationsSlice,
  relaysSlice,
  settingsSlice,
);

// Transform to only persist specific fields from the map slice
// We only want to persist savedRegion (map position) and selectedLayer (user preference)
// We don't want to persist transient state like modal open states
const mapTransform = createTransform(
  // transform state on its way to being serialized and persisted
  (inboundState: any, key) => {
    if (key === "map") {
      return {
        savedRegion: inboundState.savedRegion,
        selectedLayer: inboundState.selectedLayer,
      };
    }
    return inboundState;
  },
  // transform state being rehydrated
  (outboundState: any, _key) => {
    return outboundState;
  },
  // define which reducers this transform gets called for
  { whitelist: ["map"] },
);

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["events", "keystore", "map", "notifications", "settings"], // Only persist these reducers
  transforms: [mapTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: true,
      serializableCheck: {
        ignoredActionPaths: ["meta.promise", "register", "rehydrate"],
      },
      immutableCheck: false,
    })
      .prepend(promiseMiddleware)
      .concat(sagaMiddleware),
  devTools: !isOnDevice,
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(maybeDevToolsEnhancer),
});

export const persistor = persistStore(store);

export type AppStore = typeof store;

sagaMiddleware.run(rootSaga);

store.dispatch(startup());

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
