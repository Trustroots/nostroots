import type { Event } from "npm:nostr-tools@2.23.5";

export const defaultEvents: Event[] = [
  {
    content: "Seeded deterministic E2E note",
    created_at: 1_723_311_984,
    id: "a".repeat(64),
    kind: 30398,
    pubkey: "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b",
    sig: "b".repeat(128),
    tags: [
      ["L", "open-location-code"],
      ["l", "9F4G0000+", "open-location-code"],
    ],
  },
];
