const DEFAULT_MAX_SIZE = 10_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Bounded, in-memory set of event ids that have already been notified, so a
 * redelivered or resubmitted event doesn't push twice. It resets on restart,
 * which assumes a single daemon instance.
 */
export class SeenEvents {
  private expiresAtById: Map<string, number> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({
    maxSize = DEFAULT_MAX_SIZE,
    ttlMs = DEFAULT_TTL_MS,
    now = Date.now,
  }: { maxSize?: number; ttlMs?: number; now?: () => number } = {}) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get size(): number {
    return this.expiresAtById.size;
  }

  /** Marks the id as seen and returns whether it was new. */
  markIfNew(id: string): boolean {
    const now = this.now();
    this.dropExpired(now);

    if (this.expiresAtById.has(id)) {
      return false;
    }

    this.expiresAtById.set(id, now + this.ttlMs);
    if (this.expiresAtById.size > this.maxSize) {
      const oldest = this.expiresAtById.keys().next().value;
      if (oldest !== undefined) this.expiresAtById.delete(oldest);
    }
    return true;
  }

  // Entries share one TTL, so insertion order is expiry order.
  private dropExpired(now: number): void {
    for (const [id, expiresAt] of this.expiresAtById) {
      if (expiresAt > now) return;
      this.expiresAtById.delete(id);
    }
  }
}
