declare namespace chrome {
  namespace runtime {
    interface LastError {
      message?: string;
    }

    interface MessageSender {
      tab?: { id?: number; windowId?: number };
      url?: string;
    }

    const id: string;
    const lastError: LastError | undefined;
    function getURL(path: string): string;
    function openOptionsPage(): Promise<void>;
    function openOptionsPage(callback: () => void): void;
    const onInstalled: {
      addListener(callback: (details: { reason?: string }) => void): void;
    };
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    function sendMessage(message: unknown): Promise<unknown>;
    function sendMessage(message: unknown, callback: (response: unknown) => void): void;
  }

  namespace storage {
    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }

    interface StorageArea {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      get(
        keys: string | string[] | Record<string, unknown> | null | undefined,
        callback: (items: Record<string, unknown>) => void,
      ): void;
      set(items: Record<string, unknown>): Promise<void>;
      set(items: Record<string, unknown>, callback: () => void): void;
      remove(keys: string | string[]): Promise<void>;
      remove(keys: string | string[], callback: () => void): void;
      clear(): Promise<void>;
      clear(callback: () => void): void;
    }

    const local: StorageArea;
    const onChanged: {
      addListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    };
  }

  namespace windows {
    interface Window {
      id?: number;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
    }

    type CreateData = {
      url: string;
      type?: "normal" | "popup" | "panel" | "detached_panel";
      width?: number;
      height?: number;
      left?: number;
      top?: number;
    };

    function create(createData: CreateData): Promise<Window>;
    function create(createData: CreateData, callback: (createdWindow: Window) => void): void;
    function remove(windowId: number): Promise<void>;
    function remove(windowId: number, callback: () => void): void;
    function getLastFocused(): Promise<Window>;
    function getLastFocused(callback: (window: Window) => void): void;
    const onRemoved: {
      addListener(callback: (windowId: number) => void): void;
    };
  }

  namespace tabs {
    function create(createProperties: { url: string }): Promise<unknown>;
    function create(createProperties: { url: string }, callback: (tab: unknown) => void): void;
  }
}
