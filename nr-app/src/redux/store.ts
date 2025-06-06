import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import createSagaMiddleware from "redux-saga";
import { promiseMiddleware } from "redux-saga-promise-actions";

import { Platform } from "react-native";
import devtoolsEnhancer from "redux-devtools-expo-dev-plugin";
import rootSaga from "./sagas/root.saga";
import { eventsSlice } from "./slices/events.slice";
import { keystoreSlice } from "./slices/keystore.slice";
import { mapSlice } from "./slices/map.slice";
import { relaysSlice } from "./slices/relays.slice";
import { settingsSlice } from "./slices/settings.slice";
import { notificationsSlice } from "./slices/notifications.slice";
import { startup } from "./actions/startup.actions";

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

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["events", "keystore", "notifications", "settings"], // Only persist these reducers
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
      serializableCheck: {
        ignoredActionPaths: ["meta.promise", "register", "rehydrate"],
      },
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
