import Foundation

enum RelaySettingsActionFailureFormatter {
    enum Action {
        case addRelay
        case removeRelay
        case restoreDefaults
    }

    static func statusText(error: Error, action: Action) -> String {
        let message = error.localizedDescription
        switch action {
        case .addRelay:
            if error as? RelayEndpointInputError == .duplicate {
                return "\(message) Use the relay already listed, or enter a different relay address."
            }
            if error as? RelayEndpointInputError == .relaySettingsUnavailable {
                return "\(message) This build can only use the bundled relay list."
            }
            return "\(message) Check the relay address, then Add Relay again."
        case .removeRelay:
            if error as? RelayEndpointInputError == .cannotRemoveBuiltIn {
                return "\(message) Turn off Receive and Share instead."
            }
            if error as? RelayEndpointInputError == .relaySettingsUnavailable {
                return "\(message) This build can only use the bundled relay list."
            }
            if error as? RelayEndpointInputError == .notFound {
                return "\(message) Refresh Relay Settings before trying again."
            }
            return "\(message) Try Remove Relay again."
        case .restoreDefaults:
            if error as? RelayEndpointInputError == .relaySettingsUnavailable {
                return "\(message) This build can only use the bundled relay list."
            }
            return "\(message) Try Restore Defaults again."
        }
    }
}
