type ExtensionRuntime = typeof chrome.runtime;
type ExtensionStorageArea = chrome.storage.StorageArea;
type ExtensionStorage = typeof chrome.storage;
type ExtensionWindows = typeof chrome.windows;
type ExtensionTabs = typeof chrome.tabs;

type ExtensionNamespace = {
  runtime: ExtensionRuntime;
  storage: Pick<ExtensionStorage, "local" | "onChanged">;
  windows: ExtensionWindows;
  tabs: ExtensionTabs;
};

const globalApi = globalThis as typeof globalThis & {
  browser?: ExtensionNamespace;
  chrome?: ExtensionNamespace;
};

export const extensionApi = {
  runtime: {
    getURL: (path: string) => currentApi().api.runtime.getURL(path),
    openOptionsPage: () => {
      currentApi().api.runtime.openOptionsPage();
    },
    onInstalled: {
      addListener: (callback: Parameters<ExtensionRuntime["onInstalled"]["addListener"]>[0]) => {
        currentApi().api.runtime.onInstalled.addListener(callback);
      },
    },
    onMessage: {
      addListener: (callback: Parameters<ExtensionRuntime["onMessage"]["addListener"]>[0]) => {
        currentApi().api.runtime.onMessage.addListener(callback);
      },
    },
    sendMessage: <T = unknown>(message: unknown): Promise<T> =>
      callWithCallback<T>(
        (api) => api.runtime.sendMessage(message) as Promise<T>,
        (api, callback) => api.runtime.sendMessage(message, callback as (response: unknown) => void),
      ),
  },
  storage: {
    local: {
      get: (keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> =>
        callWithCallback(
          (api) => api.storage.local.get(keys),
          (api, callback) => api.storage.local.get(keys, callback),
        ),
      set: (items: Record<string, unknown>): Promise<void> =>
        callWithCallback(
          (api) => api.storage.local.set(items),
          (api, callback) => api.storage.local.set(items, callback),
        ),
      remove: (keys: string | string[]): Promise<void> =>
        callWithCallback(
          (api) => api.storage.local.remove(keys),
          (api, callback) => api.storage.local.remove(keys, callback),
        ),
      clear: (): Promise<void> =>
        callWithCallback(
          (api) => api.storage.local.clear(),
          (api, callback) => api.storage.local.clear(callback),
        ),
    },
    onChanged: {
      addListener: (callback: Parameters<ExtensionStorage["onChanged"]["addListener"]>[0]) => {
        currentApi().api.storage.onChanged.addListener(callback);
      },
    },
  },
  windows: {
    onRemoved: {
      addListener: (callback: Parameters<ExtensionWindows["onRemoved"]["addListener"]>[0]) => {
        currentApi().api.windows.onRemoved.addListener(callback);
      },
    },
    create: (createData: Parameters<ExtensionWindows["create"]>[0]): Promise<chrome.windows.Window> =>
      callWithCallback(
        (api) => api.windows.create(createData),
        (api, callback) => api.windows.create(createData, callback),
      ),
    remove: (windowId: number): Promise<void> =>
      callWithCallback(
        (api) => api.windows.remove(windowId),
        (api, callback) => api.windows.remove(windowId, callback),
      ),
    getLastFocused: (): Promise<chrome.windows.Window> =>
      callWithCallback(
        (api) => api.windows.getLastFocused(),
        (api, callback) => api.windows.getLastFocused(callback),
      ),
  },
  tabs: {
    create: (createProperties: Parameters<ExtensionTabs["create"]>[0]): Promise<unknown> =>
      callWithCallback(
        (api) => api.tabs.create(createProperties),
        (api, callback) => api.tabs.create(createProperties, callback),
      ),
  },
};

function callWithCallback<T>(
  promiseCall: (api: ExtensionNamespace) => Promise<T> | T,
  callbackCall: (api: ExtensionNamespace, callback: (value: T) => void) => void,
): Promise<T> {
  const { api, usesBrowserNamespace } = currentApi();
  if (usesBrowserNamespace) return Promise.resolve(promiseCall(api));

  return new Promise((resolve, reject) => {
    try {
      callbackCall(api, (value) => {
        const error = globalApi.chrome?.runtime.lastError;
        if (error) {
          reject(new Error(error.message || "WebExtensions API call failed."));
        } else {
          resolve(value);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function currentApi(): { api: ExtensionNamespace; usesBrowserNamespace: boolean } {
  const browserNamespace = globalApi.browser;
  const api = browserNamespace ?? globalApi.chrome;
  if (!api) throw new Error("No WebExtensions API is available.");
  return { api, usesBrowserNamespace: Boolean(browserNamespace) };
}
