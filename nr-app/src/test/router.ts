import type React from "react";

type Href = string | { pathname: string; params?: Record<string, unknown> };

type RouterCalls = {
  push: jest.Mock;
  replace: jest.Mock;
  dismissTo: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock<boolean, []>;
};

type RouterState = {
  pathname: string;
  searchParams: Record<string, string | undefined>;
  router: RouterCalls;
};

const defaultRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};

const routerState: RouterState = {
  pathname: "/",
  searchParams: {},
  router: defaultRouter,
};

const Redirect = jest.fn(({ href }: { href: Href }) => {
  routerState.router.replace(href);
  return null;
});
const useLocalSearchParams = jest.fn(() => routerState.searchParams);
const usePathname = jest.fn(() => routerState.pathname);
const useRouter = jest.fn(() => routerState.router);

export function resetRouterMock() {
  routerState.pathname = "/";
  routerState.searchParams = {};
  Object.values(routerState.router).forEach((mock) => mock.mockClear());
  routerState.router.canGoBack.mockReturnValue(false);
  Redirect.mockClear();
  useLocalSearchParams.mockClear();
  useLocalSearchParams.mockImplementation(() => routerState.searchParams);
  usePathname.mockClear();
  usePathname.mockImplementation(() => routerState.pathname);
  useRouter.mockClear();
  useRouter.mockImplementation(() => routerState.router);
}

export function setRouterPathname(pathname: string) {
  routerState.pathname = pathname;
}

export function setRouterSearchParams(
  searchParams: Record<string, string | undefined>,
) {
  routerState.searchParams = searchParams;
}

export function getRouterMock() {
  return routerState.router;
}

export function createExpoRouterMock() {
  const Slot = ({ children }: { children?: React.ReactNode }) =>
    children ?? null;
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    children ?? null;
  Stack.Screen = () => null;

  return {
    Redirect,
    Slot,
    Stack,
    Tabs: ({ children }: { children?: React.ReactNode }) => children ?? null,
    Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
    router: routerState.router,
    useFocusEffect: (callback: () => void | (() => void)) => {
      const React = require("react");
      React.useEffect(callback, [callback]);
    },
    useLocalSearchParams,
    usePathname,
    useRouter,
  };
}
