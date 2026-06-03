import Foundation

struct RelaySubscription: Hashable {
    let eventKind: Int
    let recipientPubkeys: [String]
}

protocol RelayClient {
    var relayURL: URL { get }
    var isAuthenticated: Bool { get }
    var incomingEvents: AsyncStream<NostrEvent> { get }

    func connect() async throws
    func authenticate(with keyStore: KeyStore) async throws
    func publish(_ event: NostrEvent) async throws
    func subscribe(_ subscription: RelaySubscription) async throws
}

protocol RelayRuntimeResetting {
    func resetRelayRuntimeForKeyChange()
}
