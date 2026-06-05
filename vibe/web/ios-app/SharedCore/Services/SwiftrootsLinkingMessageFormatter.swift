import Foundation

enum SwiftrootsLinkingMessageFormatter {
    static let linked = "Trustroots username connected."
    static let differentKey = "That username is linked to a different key. Copy this npub to Trustroots Networks, then verify again."

    static func verificationFailure(handle: String, error: Error) -> String {
        if let resolverError = error as? Nip05ResolverError {
            switch resolverError {
            case .nameNotFound:
                return "That Trustroots username is not linked yet. Copy this npub to Trustroots Networks, then verify again."
            case .httpStatus, .invalidResponse, .invalidPubkey:
                return "Trustroots could not confirm \(handle) yet. Try again in a moment."
            case .invalidHandle, .invalidURL:
                return "Check the username or profile link, then try again."
            }
        }

        if error is URLError {
            return "Could not reach Trustroots. Check your connection, then try again."
        }

        return "Could not verify \(handle). Try again in a moment."
    }
}
