import React from "react";
import { render, type RenderOptions } from "@testing-library/react-native";
import { Provider } from "react-redux";

import {
  createTestStore,
  type TestRootState,
  type TestStore,
} from "./testStore";
import {
  getRouterMock,
  resetRouterMock,
  setRouterPathname,
  setRouterSearchParams,
} from "./router";

type RenderWithProvidersOptions = RenderOptions & {
  canGoBack?: boolean;
  pathname?: string;
  preloadedState?: Partial<TestRootState>;
  searchParams?: Record<string, string | undefined>;
  store?: TestStore;
};

export function renderWithProviders(
  ui: React.ReactElement,
  {
    pathname = "/",
    canGoBack = false,
    preloadedState,
    searchParams = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  resetRouterMock();
  setRouterPathname(pathname);
  setRouterSearchParams(searchParams);
  getRouterMock().canGoBack.mockReturnValue(canGoBack);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    router: getRouterMock(),
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}
