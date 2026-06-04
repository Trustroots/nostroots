import Foundation

enum VibePushConstants {
    static let subscriptionKind = 10396
    static let relayURL = URL(string: "wss://relay.trustroots.org")!
    static let notificationServerPubkey = "62ab89bfb4f0e1f4f64653bfef77fcf4e9062cd9585a97d6b1f17ff953e4e032"
    static let validationPubkey = "f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b"
    static let appTopic = "org.trustroots.nostroots.browser"
    static let openLocationCodeNamespace = "open-location-code"
}

struct VibeAPNSToken: Codable, Equatable {
    let platform: String
    let provider: String
    let token: String
    let topic: String
    let environment: String

    init(token: String, topic: String = VibePushConstants.appTopic, environment: String) {
        self.platform = "ios"
        self.provider = "apns"
        self.token = token
        self.topic = topic
        self.environment = environment
    }
}

struct VibePushStoredState: Codable, Equatable {
    var enabled: Bool
    var apnsToken: VibeAPNSToken?
    var subscribedPlusCodes: [String]
    var lastPublishedAt: Int?
    var lastError: String?

    static let empty = VibePushStoredState(
        enabled: false,
        apnsToken: nil,
        subscribedPlusCodes: [],
        lastPublishedAt: nil,
        lastError: nil
    )
}

struct VibePushFilter: Codable, Equatable {
    let kinds: [Int]
    let authors: [String]
    let labelNamespaces: [String]
    let labels: [String]

    enum CodingKeys: String, CodingKey {
        case kinds
        case authors
        case labelNamespaces = "#L"
        case labels = "#l"
    }
}

struct VibePushSubscriptionFilter: Codable, Equatable {
    let filter: VibePushFilter
}

struct VibePushSubscriptionPayload: Codable, Equatable {
    let version: Int
    let client: String
    let tokens: [VibeAPNSToken]
    let filters: [VibePushSubscriptionFilter]
}

enum VibePushEventFactory {
    static func filter(for plusCode: String) -> VibePushFilter {
        VibePushFilter(
            kinds: [30398],
            authors: [VibePushConstants.validationPubkey],
            labelNamespaces: [VibePushConstants.openLocationCodeNamespace],
            labels: [plusCode]
        )
    }

    static func payload(from state: VibePushStoredState) -> VibePushSubscriptionPayload {
        let tokenList = state.enabled ? state.apnsToken.map { [$0] } ?? [] : []
        return VibePushSubscriptionPayload(
            version: 1,
            client: "vibe-browser",
            tokens: tokenList,
            filters: state.subscribedPlusCodes.map {
                VibePushSubscriptionFilter(filter: filter(for: $0))
            }
        )
    }
}
