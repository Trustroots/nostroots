import type { Filter } from "nostr-tools";
import { log } from "./log.ts";

export type PushToken = string;

export interface FilterPubkeyPair {
  readonly filter: Filter;
  readonly pubkey: string;
}

export class SubscriptionStore {
  private filtersByPubkey: Map<string, readonly Filter[]> = new Map();
  private tokensByPubkey: Map<string, readonly PushToken[]> = new Map();

  updateFilters(pubkey: string, filters: readonly Filter[]): void {
    const exists = this.filtersByPubkey.has(pubkey);
    this.filtersByPubkey.set(pubkey, filters);
    const count = filters.length;

    if (exists) {
      log.debug(
        `Updating filters from existing pubkey ${pubkey}. Count: ${count}.`,
      );
    } else {
      log.info(`Received filters from new pubkey ${pubkey}. Count: ${count}.`);
    }
  }

  updateTokens(pubkey: string, tokens: readonly PushToken[]): void {
    if (tokens.length === 0) {
      log.debug("No tokens found. Skipping.");
      return;
    }

    const exists = this.tokensByPubkey.has(pubkey);
    this.tokensByPubkey.set(pubkey, tokens);
    const count = tokens.length;

    if (exists) {
      log.debug(
        `Updating push tokens from existing pubkey ${pubkey}. Count: ${count}.`,
      );
    } else {
      log.info(
        `Received push tokens from new pubkey ${pubkey}. Count: ${count}.`,
      );
    }
  }

  getAllFilterPubkeyPairs(): readonly FilterPubkeyPair[] {
    return [...this.filtersByPubkey.entries()].flatMap(([pubkey, filters]) =>
      filters.map((filter) => ({ filter, pubkey }))
    );
  }

  getTokensForPubkey(pubkey: string): readonly PushToken[] | undefined {
    return this.tokensByPubkey.get(pubkey);
  }

  get pubkeyCount(): number {
    return this.filtersByPubkey.size;
  }

  get totalFilterCount(): number {
    return [...this.filtersByPubkey.values()].reduce(
      (sum, filters) => sum + filters.length,
      0,
    );
  }
}
