import Foundation

enum NRConstants {
    enum CryptoRuntimeMode: Equatable {
        case compatibility
        case secp256k1
    }

    struct RelayEndpoint: Hashable {
        let url: URL
        let readEnabled: Bool
        let writeEnabled: Bool
        let requiresNIP42Auth: Bool
    }

    static let defaultRelayURL = URL(string: "wss://nip42.trustroots.org")!
    static let defaultRelayEndpoints: [RelayEndpoint] = [
        .init(url: URL(string: "wss://nip42.trustroots.org")!, readEnabled: true, writeEnabled: true, requiresNIP42Auth: true),
        .init(url: URL(string: "wss://relay.trustroots.org")!, readEnabled: true, writeEnabled: true, requiresNIP42Auth: false),
        .init(url: URL(string: "wss://relay.nomadwiki.org")!, readEnabled: true, writeEnabled: true, requiresNIP42Auth: false)
    ]
    static let nostrailLocationEventKind = 24_111 // TODO: finalize with coordinated production kind
    static let authEventKind = 22_242

    static let defaultSessionDuration: TimeInterval = 2 * 60 * 60
    static let defaultPublishInterval: TimeInterval = 5 * 60
    static let defaultApproximateAccuracyMeters: Double = 500
    static let cryptoRuntimeMode: CryptoRuntimeMode = .secp256k1
}
