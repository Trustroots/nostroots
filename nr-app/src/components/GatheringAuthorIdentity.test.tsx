import { act } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/test-utils";
import { addEvent } from "@/redux/slices/events.slice";
import EventCard from "./discovery/EventCard";
import EventChatCard from "./EventChatCard";

const AUTHOR = "a".repeat(64);

function signed(overrides: Record<string, unknown>) {
  return {
    content: "",
    created_at: 1_780_000_000,
    id: "0".repeat(64),
    kind: 1,
    pubkey: AUTHOR,
    sig: "2".repeat(128),
    tags: [],
    ...overrides,
  } as never;
}

const profileClaim = signed({
  id: "1".repeat(64),
  kind: 10390,
  tags: [
    ["L", "org.trustroots:username"],
    ["l", "alice", "org.trustroots:username"],
  ],
});

const gathering = signed({
  id: "3".repeat(64),
  kind: 31923,
  content: "Bring a dish",
  tags: [
    ["d", "potluck"],
    ["title", "Potluck"],
    ["start", "1780003600"],
  ],
});

const repost = signed({
  id: "4".repeat(64),
  kind: 30398,
  pubkey: "b".repeat(64),
  tags: [
    ["d", "note"],
    ["p", AUTHOR],
    ["start", "1780003600"],
    ["title", "Meetup"],
  ],
});

function withProfileClaim(
  ui: React.ReactElement,
  claimant: ReturnType<typeof signed> = profileClaim,
) {
  const rendered = renderWithProviders(ui);
  act(() => {
    rendered.store.dispatch(
      addEvent({ event: claimant, fromRelay: "wss://relay.example" }),
    );
  });
  return rendered;
}

describe("gathering author identity", () => {
  it("does not badge or link a gathering author for a self-asserted username", () => {
    const { queryByText, queryByTestId, toJSON } = withProfileClaim(
      <EventChatCard
        eventWithMetadata={{
          event: gathering,
          metadata: { seenOnRelays: [] },
        }}
        isSelected={false}
      />,
    );

    expect(queryByText("alice")).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain("BadgeCheck");
    expect(JSON.stringify(toJSON())).not.toContain("trustroots.org/profile");
    expect(queryByTestId("verified-badge")).toBeNull();
  });

  it("does not badge a gathering author in discovery", () => {
    const { queryByTestId, queryByText } = withProfileClaim(
      <EventCard
        eventWithMetadata={{
          event: gathering,
          metadata: { seenOnRelays: [] },
        }}
      />,
    );

    expect(queryByText("alice")).toBeTruthy();
    expect(queryByTestId("verified-badge")).toBeNull();
  });

  it("still badges an author of a server-validated repost", () => {
    const { queryByTestId } = withProfileClaim(
      <EventCard
        eventWithMetadata={{ event: repost, metadata: { seenOnRelays: [] } }}
      />,
    );

    expect(queryByTestId("verified-badge")).toBeTruthy();
  });
});
