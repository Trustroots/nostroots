import { createMockRelay, createMockVerifiedEvent } from "@/test/nostrMocks";
import { publishVerifiedEventToRelay } from "./publish.nostr";
import { getRelay } from "./relays.nostr";

jest.mock("./relays.nostr", () => ({
  getRelay: jest.fn(),
}));

describe("publish.nostr", () => {
  it("publishes verified events to the requested relay", async () => {
    const relay = createMockRelay();
    (getRelay as jest.Mock).mockResolvedValue(relay);
    const event = createMockVerifiedEvent();

    await expect(
      publishVerifiedEventToRelay(event, "wss://relay.example"),
    ).resolves.toBe("ok");

    expect(getRelay).toHaveBeenCalledWith("wss://relay.example");
    expect(relay.publish).toHaveBeenCalledWith(event);
  });
});
