import Foundation

enum VibePushError: Error, LocalizedError, Equatable {
    case missingKey
    case invalidToken
    case publishFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingKey:
            return "No Nostr key is stored."
        case .invalidToken:
            return "No APNs token is available yet."
        case .publishFailed(let message):
            return message
        }
    }
}

protocol VibePushEventPublishing {
    func publish(_ event: NostrEvent) async throws
}

struct RelayVibePushEventPublisher: VibePushEventPublishing {
    let relayURL: URL

    init(relayURL: URL = VibePushConstants.relayURL) {
        self.relayURL = relayURL
    }

    func publish(_ event: NostrEvent) async throws {
        let eventData = try JSONEncoder().encode(event)
        guard let eventObject = try JSONSerialization.jsonObject(with: eventData) as? [String: Any] else {
            throw VibePushError.publishFailed("Could not encode subscription event.")
        }
        let messageData = try JSONSerialization.data(withJSONObject: ["EVENT", eventObject], options: [.withoutEscapingSlashes])
        guard let message = String(data: messageData, encoding: .utf8) else {
            throw VibePushError.publishFailed("Could not create relay publish message.")
        }

        let webSocket = URLSession.shared.webSocketTask(with: relayURL)
        webSocket.resume()
        defer { webSocket.cancel(with: .goingAway, reason: nil) }

        try await webSocket.send(.string(message))
    }
}

struct RecordingVibePushEventPublisher: VibePushEventPublishing {
    final class Box {
        var events: [NostrEvent] = []
    }

    let box: Box

    init(box: Box = Box()) {
        self.box = box
    }

    func publish(_ event: NostrEvent) async throws {
        box.events.append(event)
    }
}

struct VibePushSubscriptionPublisher {
    let keyStore: KeyStore
    let cryptoProvider: NostrCryptoProviding
    let eventPublisher: VibePushEventPublishing
    private let encoder = JSONEncoder()

    init(
        keyStore: KeyStore,
        cryptoProvider: NostrCryptoProviding,
        eventPublisher: VibePushEventPublishing = RelayVibePushEventPublisher()
    ) {
        self.keyStore = keyStore
        self.cryptoProvider = cryptoProvider
        self.eventPublisher = eventPublisher
    }

    func publish(state: VibePushStoredState) async throws -> NostrEvent {
        guard let pubkey = keyStore.currentPublicKeyHex(),
              let secret = keyStore.currentSecretHex() else {
            throw VibePushError.missingKey
        }

        let payload = VibePushEventFactory.payload(from: state)
        let payloadData = try encoder.encode(payload)
        guard let payloadJSON = String(data: payloadData, encoding: .utf8) else {
            throw VibePushError.publishFailed("Could not encode push subscription.")
        }
        let encrypted = try cryptoProvider.nip04Encrypt(
            plainText: payloadJSON,
            localSecretHex: secret,
            peerPubkeyHex: VibePushConstants.notificationServerPubkey
        )
        let unsigned = UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: Int(Date().timeIntervalSince1970),
            kind: VibePushConstants.subscriptionKind,
            tags: [
                ["p", VibePushConstants.notificationServerPubkey],
                ["client", "vibe-browser"]
            ],
            content: encrypted
        )
        let signed = try keyStore.sign(unsigned: unsigned)
        try await eventPublisher.publish(signed)
        return signed
    }
}
