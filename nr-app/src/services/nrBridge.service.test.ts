function mockJsonResponse({
  ok = true,
  status = 200,
  body = { success: true },
}: {
  ok?: boolean;
  status?: number;
  body?: Record<string, unknown>;
} = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

type NrBridgeService = typeof import("./nrBridge.service");

describe("nrBridge.service", () => {
  const originalEnv = process.env;

  async function loadService(baseUrl = "https://bridge.example/base") {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_NR_BRIDGE_BASE_URL: baseUrl,
    };

    return jest.requireActual("./nrBridge.service") as NrBridgeService;
  }

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse());
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("requests a verification token with JSON headers and username body", async () => {
    const { requestVerificationToken } = await loadService();

    await requestVerificationToken("alice");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://bridge.example/base/verify_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "alice" }),
      },
    );
  });

  it("authenticates with a six-digit code", async () => {
    const { authenticateWithCode } = await loadService();

    await authenticateWithCode({
      username: "alice",
      npub: "npub1abc",
      code: "123456",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://bridge.example/base/authenticate",
      expect.objectContaining({
        body: JSON.stringify({
          username: "alice",
          npub: "npub1abc",
          code: "123456",
        }),
      }),
    );
  });

  it("authenticates with a deep-link token", async () => {
    const { authenticateWithToken } = await loadService();

    await authenticateWithToken({
      username: "alice",
      npub: "npub1abc",
      token: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://bridge.example/base/authenticate",
      expect.objectContaining({
        body: JSON.stringify({
          username: "alice",
          npub: "npub1abc",
          token: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
  });

  it.each([
    [404, "not-found"],
    [409, "already-pending"],
    [401, "invalid-or-expired"],
  ])("maps status %s to %s", async (status, code) => {
    const { requestVerificationToken } = await loadService();

    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        ok: false,
        status,
        body: { error: "Bridge error" },
      }),
    );

    await expect(requestVerificationToken("alice")).rejects.toMatchObject({
      code,
      status,
      message: "Bridge error",
    });
  });

  it("maps failed fetches to network errors", async () => {
    const { requestVerificationToken } = await loadService();

    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(requestVerificationToken("alice")).rejects.toMatchObject({
      code: "network",
    });
  });

  it("sends a support message with a NIP-98 token scoped to the request", async () => {
    const { sendSupportMessage } = await loadService();
    const { finalizeEvent, generateSecretKey } =
      jest.requireActual("nostr-tools/pure");
    const secretKey = generateSecretKey();

    await sendSupportMessage({
      message: "the map does not load",
      sign: async (template) => finalizeEvent(template, secretKey),
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://bridge.example/base/support");
    expect(init.body).toBe(
      JSON.stringify({ message: "the map does not load" }),
    );

    const authorization: string = init.headers.Authorization;
    expect(authorization.startsWith("Nostr ")).toBe(true);

    const event = JSON.parse(
      Buffer.from(authorization.slice("Nostr ".length), "base64").toString(),
    );
    expect(event.kind).toBe(27235);
    expect(event.tags).toContainEqual([
      "u",
      "https://bridge.example/base/support",
    ]);
    expect(event.tags).toContainEqual(["method", "POST"]);
  });

  it("surfaces a signing failure rather than sending unsigned", async () => {
    const { sendSupportMessage } = await loadService();

    await expect(
      sendSupportMessage({
        message: "help",
        sign: () => Promise.reject(new Error("no key")),
      }),
    ).rejects.toThrow("no key");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a config error when the bridge URL is missing", async () => {
    const { NrBridgeError, requestVerificationToken } = await loadService("");

    await expect(requestVerificationToken("alice")).rejects.toBeInstanceOf(
      NrBridgeError,
    );
    await expect(requestVerificationToken("alice")).rejects.toMatchObject({
      code: "config",
    });
  });
});
