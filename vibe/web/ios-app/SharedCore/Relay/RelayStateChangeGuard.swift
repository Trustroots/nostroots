import Foundation

enum RelayStateChangeImpact: Equatable {
    case disablesReceiving
    case disablesSharing

    var title: String {
        switch self {
        case .disablesReceiving:
            return "Turn off receiving?"
        case .disablesSharing:
            return "Turn off sharing?"
        }
    }

    var message: String {
        switch self {
        case .disablesReceiving:
            return "Swiftroots will not receive updates until you turn receiving back on."
        case .disablesSharing:
            return "Swiftroots will not share updates until you turn sharing back on."
        }
    }

    var actionTitle: String {
        switch self {
        case .disablesReceiving:
            return "Turn Off Receiving"
        case .disablesSharing:
            return "Turn Off Sharing"
        }
    }
}

enum RelayStateChangeGuard {
    static func impact(
        ofChanging url: URL,
        toReadEnabled readEnabled: Bool,
        writeEnabled: Bool,
        in endpoints: [NRConstants.RelayEndpoint]
    ) -> RelayStateChangeImpact? {
        guard let current = endpoints.first(where: { $0.url == url }) else {
            return nil
        }

        if current.readEnabled,
           !readEnabled,
           endpoints.filter(\.readEnabled).count == 1 {
            return .disablesReceiving
        }

        if current.writeEnabled,
           !writeEnabled,
           endpoints.filter(\.writeEnabled).count == 1 {
            return .disablesSharing
        }

        return nil
    }
}
