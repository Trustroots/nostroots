import { profilesActions } from "../slices/profiles.slice";
import {
  fetchKind0FromRelays,
  fetchProfileWorker,
  profilesSaga,
} from "./profiles.saga";

const mockPoolGet = jest.fn();
const mockPoolClose = jest.fn();

jest.mock("nostr-tools/pool", () => ({
  SimplePool: jest.fn(() => ({
    get: mockPoolGet,
    close: mockPoolClose,
  })),
}));

describe("profiles.saga", () => {
  const pubkey = "1".repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  it("skips a profile that is still fresh", () => {
    const generator = fetchProfileWorker(profilesActions.fetchProfile(pubkey));

    expect(generator.next().value).toMatchObject({ type: "SELECT" });
    expect(generator.next({ fetchedAt: 999 }).value).toMatchObject({
      type: "PUT",
      payload: { action: profilesActions.fetchProfileFailed(pubkey) },
    });
    expect(generator.next().done).toBe(true);
  });

  it("stores a profile returned by an active relay", () => {
    const generator = fetchProfileWorker(profilesActions.fetchProfile(pubkey));
    generator.next();
    expect(generator.next(undefined).value).toMatchObject({ type: "SELECT" });
    expect(generator.next(["wss://relay.example"]).value).toMatchObject({
      type: "RACE",
    });

    const result = {
      content: JSON.stringify({
        display_name: "Alice",
        name: "alice",
        picture: "https://example.com/alice.jpg",
        about: "Traveler",
        nip05: "alice@example.com",
      }),
    };
    expect(generator.next({ result }).value).toMatchObject({
      type: "PUT",
      payload: {
        action: profilesActions.setProfile({
          pubkey,
          name: "Alice",
          picture: "https://example.com/alice.jpg",
          about: "Traveler",
          nip05: "alice@example.com",
          fetchedAt: 1000,
        }),
      },
    });
    expect(generator.next().done).toBe(true);
  });

  it("falls back to the profile name and handles relay timeouts", () => {
    const success = fetchProfileWorker(profilesActions.fetchProfile(pubkey));
    success.next();
    success.next(undefined);
    success.next([]);
    expect(
      success.next({ result: { content: JSON.stringify({ name: "alice" }) } })
        .value,
    ).toMatchObject({
      payload: { action: { payload: { name: "alice" } } },
    });

    const timeout = fetchProfileWorker(profilesActions.fetchProfile(pubkey));
    timeout.next();
    timeout.next(undefined);
    timeout.next([]);
    expect(timeout.next({ timeout: true }).value).toMatchObject({
      payload: { action: profilesActions.fetchProfileFailed(pubkey) },
    });
  });

  it("turns malformed profile content into a failed fetch", () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const generator = fetchProfileWorker(profilesActions.fetchProfile(pubkey));
    generator.next();
    generator.next(undefined);
    generator.next([]);

    expect(generator.next({ result: { content: "{" } }).value).toMatchObject({
      payload: { action: profilesActions.fetchProfileFailed(pubkey) },
    });
  });

  it("fetches kind 0 events and always closes the pool", async () => {
    const event = { content: "{}" };
    mockPoolGet.mockResolvedValueOnce(event);

    await expect(
      fetchKind0FromRelays(pubkey, ["wss://relay.example"]),
    ).resolves.toBe(event);
    expect(mockPoolGet).toHaveBeenCalledWith(["wss://relay.example"], {
      kinds: [0],
      authors: [pubkey],
    });
    expect(mockPoolClose).toHaveBeenCalledWith(["wss://relay.example"]);

    mockPoolGet.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchKind0FromRelays(pubkey, [])).rejects.toThrow("offline");
    expect(mockPoolClose).toHaveBeenLastCalledWith([]);
  });

  it("watches for profile fetch actions", () => {
    expect(profilesSaga().next().value).toMatchObject({ type: "ALL" });
  });
});
