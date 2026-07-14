import Foundation

enum NostrailLocationStatusFormatter {
    static let initialLocationPrompt = "Choose your current approximate area before sharing."
    static let permissionDenied = "Location permission is off. Enable it in Settings to jump to your current area."
    static let permissionUnavailable = "Location permission is unavailable."
    static let currentAreaReady = "Using current approximate area."

    static func failureText(_ message: String) -> String {
        "Could not get current location: \(message)"
    }

    static func isPermissionSettingsStatus(_ statusText: String) -> Bool {
        statusText == permissionDenied
    }

    static func isRetryableLocationFailureStatus(_ statusText: String) -> Bool {
        statusText.hasPrefix("Could not get current location:")
    }

    static func shouldClearAfterRecipientChange(_ statusText: String) -> Bool {
        isRetryableLocationFailureStatus(statusText)
    }
}
