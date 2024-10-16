import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import {
  SLICE_NAME as eventsName,
  default as eventsReducer,
} from "./slices/events.slice";
import {
  SLICE_NAME as mapName,
  default as mapReducer,
} from "./slices/map.slice";
import rootSaga from "./sagas/root.saga";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    [eventsName]: eventsReducer,
    [mapName]: mapReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(sagaMiddleware),
});

sagaMiddleware.run(rootSaga);

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
