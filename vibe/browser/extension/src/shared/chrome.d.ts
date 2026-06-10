declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number; windowId?: number };
      url?: string;
    }

    const id: string;
    function getURL(path: string): string;
    function openOptionsPage(): void;
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
    function sendMessage(message: unknown, callback?: (response: unknown) => void): void;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
  }

  namespace windows {
    interface Window {
      id?: number;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
    }

    function create(createData: {
      url: string;
      type?: "normal" | "popup" | "panel" | "detached_panel";
      width?: number;
      height?: number;
      left?: number;
      top?: number;
    }): Promise<Window>;
    function remove(windowId: number): Promise<void>;
    function getLastFocused(): Promise<Window>;
    const onRemoved: {
      addListener(callback: (windowId: number) => void): void;
    };
  }

  namespace tabs {
    function create(createProperties: { url: string }): Promise<unknown>;
  }
}
