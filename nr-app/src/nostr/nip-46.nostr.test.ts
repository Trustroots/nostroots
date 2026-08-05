import { accountFromSeedWords } from "nip06";
import { sendConnectResponse } from "./nip-46.nostr";

jest.mock("nostr-tools", () => ({
  ...jest.requireActual("nostr-tools"),
  Relay: (() => {
    const mockPublish = jest.fn(async () => "ok");
    const mockRelayConnect = jest.fn(async () => ({ publish: mockPublish }));
    return {
      __mockPublish: mockPublish,
      connect: mockRelayConnect,
    };
  })(),
}));

const relayMock = jest.requireMock("nostr-tools").Relay as {
  __mockPublish: jest.Mock;
  connect: jest.Mock;
};

describe("nip-46.nostr", () => {
  const clientAccount = accountFromSeedWords({
    mnemonic:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  });

  beforeEach(() => {
    relayMock.__mockPublish.mockClear();
    relayMock.connect.mockClear();
  });

  it("publishes an encrypted connect response", async () => {
    const clientPubkey = clientAccount.publicKey.hex;

    await sendConnectResponse(
      `nostrconnect://${clientPubkey}?relay=wss%3A%2F%2Frelay.example&secret=secret123`,
    );

    expect(relayMock.connect).toHaveBeenCalledWith("wss://relay.example");
    expect(relayMock.__mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(String),
        kind: 24133,
        tags: [["p", clientPubkey]],
      }),
    );
  });

  it("does not publish invalid connect URIs", async () => {
    jest.spyOn(console, "error").mockImplementationOnce(() => undefined);

    await sendConnectResponse("nostrconnect://missing-secret");

    expect(relayMock.connect).not.toHaveBeenCalled();
    expect(relayMock.__mockPublish).not.toHaveBeenCalled();
  });
});
