describe("relays.nostr", () => {
  it("connects and reuses relay instances by URL", async () => {
    const connect = jest.fn(async () => undefined);
    const relayConstructor = jest.fn(function Relay(
      this: unknown,
      url: string,
    ) {
      return { connect, url };
    });
    relayConstructor.connect = jest.fn(async (url: string) => ({
      connect,
      url,
    }));

    jest.isolateModules(() => {
      jest.doMock("nostr-tools", () => ({
        ...jest.requireActual("nostr-tools"),
        Relay: relayConstructor,
      }));
    });

    let relays: typeof import("./relays.nostr");
    jest.isolateModules(() => {
      relays = require("./relays.nostr");
    });

    const first = await relays!.getRelay("wss://relay.example");
    const second = await relays!.getRelay("wss://relay.example");

    expect(first).toBe(second);
    expect(relayConstructor).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(relays!.getAllRelays()).toEqual([first]);
  });
});
