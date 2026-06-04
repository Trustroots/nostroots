import Foundation

enum NostrailActionErrorFormatter {
    static let expiredSessionMessage = "Sharing session expired."

    static func message(
        for error: Error,
        serviceStatusText: String? = nil,
        relayContext: RelayUserFacingMessageFormatter.Context = .publish
    ) -> String {
        if let serviceError = error as? LocationSharingServiceError {
            switch serviceError {
            case .recipientResolutionFailed(let input, _):
                return "Could not find \(input). Check the Trustroots username, profile link, NIP-05 address, npub, or public key."
            case .noActiveSession:
                if serviceStatusText == expiredSessionMessage {
                    return expiredSessionMessage
                }
                return serviceError.localizedDescription
            case .missingRecipient, .keyChangeWhileSharing:
                return serviceError.localizedDescription
            }
        }
        if error is RelayPoolError || error is RelayClientError || (error as NSError).domain == NSURLErrorDomain {
            return RelayUserFacingMessageFormatter.message(for: error, context: relayContext)
        }
        return error.localizedDescription
    }

    static func isRetryableRelayFailure(_ error: Error) -> Bool {
        if let relayPoolError = error as? RelayPoolError {
            switch relayPoolError {
            case .connectFailed, .publishFailed, .subscribeFailed:
                return true
            case .noEnabledRelays, .noReadableRelays, .noWritableRelays:
                return false
            }
        }
        return error is RelayClientError || (error as NSError).domain == NSURLErrorDomain
    }
}
