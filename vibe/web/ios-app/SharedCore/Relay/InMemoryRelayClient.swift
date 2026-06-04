import Foundation

final class InMemoryRelayClient: RelayClient, RelayRuntimeResetting {
    let relayURL: URL
    private(set) var isAuthenticated = false
    private var subscriptions: [RelaySubscription] = []
    private var continuation: AsyncStream<NostrEvent>.Continuation?

    lazy var incomingEvents: AsyncStream<NostrEvent> = AsyncStream { continuation in
        self.continuation = continuation
    }

    init(relayURL: URL = NRConstants.defaultRelayURL) {
        self.relayURL = relayURL
    }

    func connect() async throws {
        // Prototype transport: in-memory relay, no socket handshake.
    }

    func authenticate(with keyStore: KeyStore) async throws {
        let challenge = UUID().uuidString
        _ = try NIP42Auth.makeAuthEvent(challenge: challenge, relayURL: relayURL, keyStore: keyStore)
        isAuthenticated = true
    }

    func publish(_ event: NostrEvent) async throws {
        guard isAuthenticated else {
            throw NSError(domain: "RelayClient", code: 401, userInfo: [NSLocalizedDescriptionKey: "Relay auth required"])
        }
        guard !event.isExpired else { return }
        for subscription in subscriptions where matches(event: event, subscription: subscription) {
            continuation?.yield(event)
        }
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        subscriptions.append(subscription)
    }

    func resetRelayRuntimeForKeyChange() {
        isAuthenticated = false
        subscriptions = []
    }

    private func matches(event: NostrEvent, subscription: RelaySubscription) -> Bool {
        guard event.kind == subscription.eventKind else { return false }
        guard !subscription.recipientPubkeys.isEmpty else { return true }
        let recipients = Set(event.recipients)
        return !recipients.isDisjoint(with: subscription.recipientPubkeys)
    }
}
