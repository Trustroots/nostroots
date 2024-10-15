import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import {
  SLICE_NAME as eventsName,
  default as eventsReducer,
} from "./eventsSlice";
import { SLICE_NAME as mapName, default as mapReducer } from "./mapSlice";
import rootSaga from "./sagas";

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
