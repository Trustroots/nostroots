import type { APNSToken, VibeNostrFilter } from "./schema.ts";

export interface FilterPubkeyPair {
  readonly filter: VibeNostrFilter;
  readonly pubkey: string;
}

export class SubscriptionStore {
  private filtersByPubkey = new Map<string, readonly VibeNostrFilter[]>();
  private tokensByPubkey = new Map<string, readonly APNSToken[]>();

  update(pubkey: string, filters: readonly VibeNostrFilter[], tokens: readonly APNSToken[]): void {
    this.filtersByPubkey.set(pubkey, filters);
    this.tokensByPubkey.set(pubkey, tokens);
  }

  getAllFilterPubkeyPairs(): readonly FilterPubkeyPair[] {
    return [...this.filtersByPubkey.entries()].flatMap(([pubkey, filters]) =>
      filters.map((filter) => ({ filter, pubkey }))
    );
  }

  getTokensForPubkey(pubkey: string): readonly APNSToken[] {
    return this.tokensByPubkey.get(pubkey) ?? [];
  }

  get pubkeyCount(): number {
    return this.filtersByPubkey.size;
  }

  get totalFilterCount(): number {
    return [...this.filtersByPubkey.values()].reduce((sum, filters) => sum + filters.length, 0);
  }
}
