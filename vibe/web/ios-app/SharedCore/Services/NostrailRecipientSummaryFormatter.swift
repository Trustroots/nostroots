import Foundation

enum NostrailRecipientSummaryFormatter {
    static let recipientSheetEmptyText = "Add a Trustroots username, profile link, @username, username@trustroots.org, npub, or public key before inviting or sharing."

    static func sharingSummary(
        recipients: [String],
        hasLocationFix: Bool,
        isWaitingForLocation: Bool
    ) -> String {
        if recipients.isEmpty {
            return "Add recipients from the map button before sharing."
        }
        if !hasLocationFix {
            if isWaitingForLocation {
                return "Waiting for iOS to return your approximate area."
            }
            return "Use the current-location button before starting a sharing session."
        }
        return "Recipients: \(compactList(recipients))."
    }

    static func compactList(_ recipients: [String], visibleCount: Int = 2) -> String {
        let visible = recipients.prefix(max(1, visibleCount)).map(shortDisplayName)
        let remaining = recipients.count - visible.count
        if remaining > 0 {
            return (visible + ["+\(remaining) more"]).joined(separator: ", ")
        }
        return visible.joined(separator: ", ")
    }

    static func shortDisplayName(_ value: String) -> String {
        guard value.count > 24 else {
            return value
        }
        return "\(value.prefix(12))...\(value.suffix(6))"
    }
}
