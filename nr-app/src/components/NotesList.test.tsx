import {
  MAP_NOTE_REPOST_KIND,
  NOSTROOTS_VALIDATION_PUBKEY,
  OPEN_LOCATION_CODE_LABEL_NAMESPACE,
} from "@trustroots/nr-common";

import {
  eventsAdapter,
  type EventWithMetadata,
} from "@/redux/slices/events.slice";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import NotesList from "./NotesList";

function noteEvent(
  id: string,
  plusCode: string,
  content: string,
): EventWithMetadata {
  return {
    event: {
      content,
      created_at: 1,
      id,
      kind: MAP_NOTE_REPOST_KIND,
      pubkey: NOSTROOTS_VALIDATION_PUBKEY,
      sig: "2".repeat(128),
      tags: [
        ["L", OPEN_LOCATION_CODE_LABEL_NAMESPACE],
        ["l", plusCode, OPEN_LOCATION_CODE_LABEL_NAMESPACE],
      ],
    },
    metadata: {
      seenOnRelays: ["wss://relay.example"],
    },
  };
}

describe("NotesList", () => {
  it("renders empty exact and child counts", () => {
    renderWithProviders(<NotesList plusCode="9F4G0000+" />);

    expect(screen.getByText(/0 exact matches for/)).toBeTruthy();
    expect(screen.getByText(/0 within plus code/)).toBeTruthy();
  });

  it("renders exact matching notes", () => {
    const exact = noteEvent("0".repeat(64), "9F4G0000+", "Exact note");
    const events = eventsAdapter.setAll(eventsAdapter.getInitialState(), [
      exact,
    ]);

    renderWithProviders(<NotesList plusCode="9F4G0000+" />, {
      preloadedState: {
        events,
      },
    });

    expect(screen.getByText(/1 exact matches for/)).toBeTruthy();
    expect(screen.getByText("Exact note")).toBeTruthy();
  });
});
