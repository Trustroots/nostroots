import XCTest
@testable import NostrootsBrowser

final class NostrootsBrowserTests: XCTestCase {
    private let secretHex = "0000000000000000000000000000000000000000000000000000000000000001"
    private let peerPubkey = "1111111111111111111111111111111111111111111111111111111111111111"

    func testBridgeReturnsPublicKey() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        let bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: StubCryptoProvider())

        let result = try bridge.handle(method: "getPublicKey", params: nil) as? String

        XCTAssertEqual(result, StubCryptoProvider.pubkey)
    }

    func testBridgeSignsCleanTemplateAndIgnoresSpoofedFields() throws {
        let provider = StubCryptoProvider()
        let keyStore = InMemoryKeyStore(cryptoProvider: provider)
        try keyStore.importGeneratedSecret(secretHex)
        let bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: provider)

        let signed = try bridge.handle(method: "signEvent", params: [[
            "kind": 1,
            "created_at": 1_700_000_000,
            "tags": [["p", peerPubkey]],
            "content": "hello",
            "pubkey": peerPubkey,
            "id": String(repeating: "f", count: 64),
            "sig": String(repeating: "e", count: 128)
        ]]) as? [String: Any]

        XCTAssertEqual(signed?["pubkey"] as? String, StubCryptoProvider.pubkey)
        XCTAssertNotEqual(signed?["id"] as? String, String(repeating: "f", count: 64))
        XCTAssertNotEqual(signed?["sig"] as? String, String(repeating: "e", count: 128))
    }

    func testNIP01SerializationDoesNotEscapeSlashes() throws {
        let event = UnsignedNostrEvent(
            pubkey: StubCryptoProvider.pubkey,
            createdAt: 1_700_000_000,
            kind: 27_235,
            tags: [["u", "https://ateam.trustroots.org"], ["method", "nip07"]],
            content: "ateam login"
        )

        let serialized = try XCTUnwrap(String(data: NIP01.serialize(event), encoding: .utf8))

        XCTAssertTrue(serialized.contains(#""https://ateam.trustroots.org""#))
        XCTAssertFalse(serialized.contains(#"https:\/\/ateam"#))
    }

    func testBridgeRejectsUnknownMethodAndMalformedPayload() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        let bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: StubCryptoProvider())

        XCTAssertThrowsError(try bridge.handle(method: "unknown", params: []))
        XCTAssertThrowsError(try bridge.handle(method: "signEvent", params: []))
    }

    func testBridgeRejectsInvalidPeerPubkeyForEncryptedMethods() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        let bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: StubCryptoProvider())

        XCTAssertThrowsError(try bridge.handle(method: "nip44.encrypt", params: ["not-a-pubkey", "plain"]))
        XCTAssertThrowsError(try bridge.handle(method: "nip04.decrypt", params: ["not-a-pubkey", "cipher"]))
    }

    func testBridgeRoutesNIP44AndNIP04() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        let bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: StubCryptoProvider())

        XCTAssertEqual(try bridge.handle(method: "nip44.encrypt", params: [peerPubkey, "plain"]) as? String, "nip44:plain")
        XCTAssertEqual(try bridge.handle(method: "nip44.decrypt", params: [peerPubkey, "cipher"]) as? String, "plain44:cipher")
        XCTAssertEqual(try bridge.handle(method: "nip04.encrypt", params: [peerPubkey, "plain"]) as? String, "nip04:plain")
        XCTAssertEqual(try bridge.handle(method: "nip04.decrypt", params: [peerPubkey, "cipher"]) as? String, "plain04:cipher")
    }

    func testKeyImportAndGeneration() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        XCTAssertEqual(keyStore.currentSecretHex(), secretHex)

        let nsec = try NIP19.encodeNsec(secretHex: secretHex)
        try keyStore.importSecret(nsec)
        XCTAssertEqual(keyStore.currentSecretHex(), secretHex)
    }

    func testNavigationPolicy() {
        let policy = BrowserNavigationPolicy()

        XCTAssertEqual(policy.decision(for: URL(string: "https://nos.trustroots.org/")), .allow)
        XCTAssertEqual(policy.decision(for: URL(string: "https://example.com/")), .allow)
        XCTAssertEqual(policy.decision(for: URL(string: "mailto:hello@example.com")), .openExternally)
    }

    func testNostrootsWebRequestRevalidatesCachedContent() {
        let request = NativeBrowserWebView.webRequest(
            for: URL(string: "https://nos.trustroots.org/")!
        )

        XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Cache-Control"), "no-cache")
    }

    func testExternalWebRequestKeepsDefaultCaching() {
        let request = NativeBrowserWebView.webRequest(
            for: URL(string: "https://example.com/")!
        )

        XCTAssertEqual(request.cachePolicy, .useProtocolCachePolicy)
        XCTAssertNil(request.value(forHTTPHeaderField: "Cache-Control"))
    }

    func testNIP07PermissionPolicyAutoAllowsTrustrootsAndHitchwikiOnly() {
        let policy = NIP07PermissionPolicy()

        XCTAssertTrue(policy.isAutoAllowed(origin: "https://trustroots.org"))
        XCTAssertTrue(policy.isAutoAllowed(origin: "https://nos.trustroots.org"))
        XCTAssertTrue(policy.isAutoAllowed(origin: "https://ateam.trustroots.org"))
        XCTAssertTrue(policy.isAutoAllowed(origin: "https://hitchwiki.org"))
        XCTAssertTrue(policy.isAutoAllowed(origin: "https://maps.hitchwiki.org"))
        XCTAssertFalse(policy.isAutoAllowed(origin: "https://example.com"))
        XCTAssertFalse(policy.isAutoAllowed(origin: "https://trustroots.org.example.com"))
    }

    func testNIP07PermissionStoreRemembersApprovedOrigins() {
        let store = InMemoryNIP07PermissionStore()
        let policy = NIP07PermissionPolicy()
        let origin = "https://example.com"

        XCTAssertFalse(store.isAllowed(origin: origin))
        store.allow(origin: origin)
        XCTAssertTrue(store.isAllowed(origin: origin))
        XCTAssertEqual(store.entries(policy: policy).first?.displayName, "example.com")
        XCTAssertEqual(store.entries(policy: policy).first?.detail, "Always allowed")

        store.revoke(origin: origin)
        XCTAssertFalse(store.isAllowed(origin: origin))
        XCTAssertTrue(store.entries(policy: policy).isEmpty)

        store.allow(origin: origin)
        store.clear()
        XCTAssertFalse(store.isAllowed(origin: origin))
    }

    func testNIP07PermissionStoreListsTrustedDomainsAfterUse() {
        let store = InMemoryNIP07PermissionStore()
        let policy = NIP07PermissionPolicy()

        store.recordTrustedUse(origin: "https://maps.hitchwiki.org")
        store.recordTrustedUse(origin: "https://nos.trustroots.org")
        store.recordTrustedUse(origin: "https://example.com")

        let entries = store.entries(policy: policy)

        XCTAssertEqual(entries.map(\.displayName), ["maps.hitchwiki.org", "nos.trustroots.org"])
        XCTAssertEqual(entries.map(\.detail), ["Trusted *.hitchwiki.org site", "Trusted *.trustroots.org site"])
        XCTAssertFalse(entries.contains { $0.origin == "https://example.com" })
        XCTAssertFalse(entries.contains { $0.canRevoke })
    }

    func testBuildTimeFormat() {
        let date = Date(timeIntervalSince1970: 1_775_000_400)
        let formatted = BuildInfo.formattedBuildTime(date)
        XCTAssertTrue(formatted.range(of: #"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$"#, options: .regularExpression) != nil)
    }

    func testRemovalWarningIsExplicit() {
        XCTAssertTrue(SettingsCopy.removeStoredKeyBody.contains("you will lose access to this Nostr identity"))
        XCTAssertTrue(SettingsCopy.removeStoredKeyConfirmation.contains("you will lose access to this Nostr identity"))
    }

    func testVibePushPayloadUsesAPNSTokenAndPlusCodeFilter() throws {
        let token = VibeAPNSToken(token: "abc123", environment: "sandbox")
        let state = VibePushStoredState(
            enabled: true,
            apnsToken: token,
            subscribedPlusCodes: ["849VCWC8+2X"],
            lastPublishedAt: nil,
            lastError: nil
        )

        let payload = VibePushEventFactory.payload(from: state)

        XCTAssertEqual(payload.version, 1)
        XCTAssertEqual(payload.client, "vibe-browser")
        XCTAssertEqual(payload.tokens, [token])
        XCTAssertEqual(payload.filters.first?.filter.kinds, [30398])
        XCTAssertEqual(payload.filters.first?.filter.labels, ["849VCWC8+2X"])
    }

    func testVibePushSubscriptionPublisherSignsKind10396() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: StubCryptoProvider())
        try keyStore.importGeneratedSecret(secretHex)
        let recorder = RecordingVibePushEventPublisher.Box()
        let publisher = VibePushSubscriptionPublisher(
            keyStore: keyStore,
            cryptoProvider: StubCryptoProvider(),
            eventPublisher: RecordingVibePushEventPublisher(box: recorder)
        )
        let state = VibePushStoredState(
            enabled: true,
            apnsToken: VibeAPNSToken(token: "abc123", environment: "sandbox"),
            subscribedPlusCodes: ["849VCWC8+2X"],
            lastPublishedAt: nil,
            lastError: nil
        )

        let event = try await publisher.publish(state: state)

        XCTAssertEqual(event.kind, VibePushConstants.subscriptionKind)
        XCTAssertEqual(event.pubkey, StubCryptoProvider.pubkey)
        XCTAssertEqual(event.tags, [["p", VibePushConstants.notificationServerPubkey], ["client", "vibe-browser"]])
        XCTAssertTrue(event.content.hasPrefix("nip04:"))
        XCTAssertEqual(recorder.events.first?.id, event.id)
    }
}

private struct StubCryptoProvider: NostrCryptoProviding {
    static let pubkey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    let algorithmLabel = "stub"

    func publicKeyHex(fromSecretHex secretHex: String) throws -> String {
        StubCryptoProvider.pubkey
    }

    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String {
        "sig-\(eventID)".padding(toLength: 128, withPad: "0", startingAt: 0)
    }

    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        "nip44:\(plainText)"
    }

    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        "plain44:\(cipherText)"
    }

    func nip04Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        "nip04:\(plainText)"
    }

    func nip04Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        "plain04:\(cipherText)"
    }
}
