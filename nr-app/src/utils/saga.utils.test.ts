import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { promiseMiddleware } from "redux-saga-promise-actions";
import { call } from "redux-saga/effects";

import { createPromiseActionSaga } from "./saga.utils";

const double = jest.fn(async (value: number) => value * 2);

const [doublePromiseAction, doubleSaga] = createPromiseActionSaga<
  number,
  number
>({
  actionTypePrefix: "test/double",
  *effect(action) {
    if (action.payload < 0) {
      const error = new Error("negative") as Error & { code: string };
      error.code = "NEGATIVE";
      throw error;
    }
    const result: number = yield call(double, action.payload);
    return result;
  },
});

function startStore() {
  const actions: { type: string; payload?: unknown }[] = [];
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: (state: null = null, action) => {
      actions.push(action);
      return state;
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(
        promiseMiddleware,
        sagaMiddleware,
      ),
  });
  const task = sagaMiddleware.run(doubleSaga);
  return { actions, store, task };
}

describe("createPromiseActionSaga", () => {
  it("names the request, success and failure actions after the prefix", () => {
    expect(doublePromiseAction.request(1).type).toBe("test/double/request");
    expect(doublePromiseAction.success(2).type).toBe("test/double/success");
    expect(doublePromiseAction.failure({ message: "x", name: "x" }).type).toBe(
      "test/double/failure",
    );
  });

  it("resolves the dispatched promise and puts a success action", async () => {
    const { actions, store, task } = startStore();

    await expect(store.dispatch(doublePromiseAction.request(21))).resolves.toBe(
      42,
    );

    expect(actions).toContainEqual(doublePromiseAction.success(42));
    task.cancel();
  });

  it("rejects the dispatched promise and puts a serializable failure", async () => {
    const { actions, store, task } = startStore();

    await expect(
      store.dispatch(doublePromiseAction.request(-1)),
    ).rejects.toThrow("negative");

    expect(actions).toContainEqual(
      doublePromiseAction.failure({
        message: "negative",
        name: "NEGATIVE",
        code: "NEGATIVE",
        data: undefined,
      }),
    );
    task.cancel();
  });
});
