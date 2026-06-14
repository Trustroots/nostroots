import type { ExtensionStorage } from "./storage";

export class MemoryStorage implements ExtensionStorage {
  private items = new Map<string, unknown>();

  async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    if (!keys) return Object.fromEntries(this.items);
    if (typeof keys === "string") return { [keys]: this.items.get(keys) };
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, this.items.get(key)]));
    }
    return Object.fromEntries(
      Object.entries(keys).map(([key, fallback]) => [key, this.items.has(key) ? this.items.get(key) : fallback]),
    );
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.items.set(key, value);
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.items.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}
