import { createSelector } from "reselect";
import {
  eventsSelectors,
  EventWithMetadata,
} from "@/redux/slices/events.slice";
import { SIGNAL_INTENTS } from "@/constants/signals";
import {
  getAuthorFromEvent,
  MAP_NOTE_REPOST_KIND,
} from "@trustroots/nr-common";
import { isEventWithinThisPlusCode } from "@/utils/event.utils";

export type CellAuthorInfo = {
  pubkey: string;
  intentEmoji?: string;
};

export type CellAuthorData = {
  authors: CellAuthorInfo[];
  totalUniqueAuthors: number;
};

function getIntentEmojiFromEvent(event: EventWithMetadata): string | undefined {
  for (const tag of event.event.tags) {
    if (tag[0] !== "t" || tag[1] === "signal") continue;
    const intent = SIGNAL_INTENTS.find((i) => i.key === tag[1]);
    if (intent) return intent.emoji;
  }
  return undefined;
}

/**
 * Given a plus code, returns up to 3 most recent unique authors with their
 * intent emoji, plus the total count of unique authors in that cell.
 */
export const selectCellAuthorsFactory = (plusCode: string) =>
  createSelector([eventsSelectors.selectAll], (events): CellAuthorData => {
    // Filter to map note reposts within this plus code
    const cellEvents = events
      .filter(
        (e) =>
          e.event.kind === MAP_NOTE_REPOST_KIND &&
          isEventWithinThisPlusCode(e.event, plusCode),
      )
      // Sort by most recent first
      .sort((a, b) => b.event.created_at - a.event.created_at);

    const seenPubkeys = new Set<string>();
    const authors: CellAuthorInfo[] = [];

    for (const event of cellEvents) {
      const pubkey = getAuthorFromEvent(event.event);
      if (seenPubkeys.has(pubkey)) continue;
      seenPubkeys.add(pubkey);

      if (authors.length < 3) {
        authors.push({
          pubkey,
          intentEmoji: getIntentEmojiFromEvent(event),
        });
      }
    }

    return {
      authors,
      totalUniqueAuthors: seenPubkeys.size,
    };
  });
