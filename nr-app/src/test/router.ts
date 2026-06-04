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

export function resetRouterMock() {
  routerState.pathname = "/";
  routerState.searchParams = {};
  Object.values(routerState.router).forEach((mock) => mock.mockClear());
  routerState.router.canGoBack.mockReturnValue(false);
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
  const Redirect = ({ href }: { href: Href }) => {
    routerState.router.replace(href);
    return null;
  };
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    children ?? null;
  Stack.Screen = () => null;

  return {
    Redirect,
    Stack,
    Tabs: ({ children }: { children?: React.ReactNode }) => children ?? null,
    Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
    router: routerState.router,
    useLocalSearchParams: () => routerState.searchParams,
    usePathname: () => routerState.pathname,
    useRouter: () => routerState.router,
  };
}
