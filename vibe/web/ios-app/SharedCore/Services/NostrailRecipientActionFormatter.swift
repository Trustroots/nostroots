import Foundation

enum NostrailRecipientActionFormatter {
    static let currentAreaChangedStatus = "Current area changed. Nostrail will update automatically, or you can share this area now."

    static func mapRecipientButtonTitle(count: Int) -> String {
        guard count > 0 else {
            return "Add People"
        }
        return count == 1 ? "1 Person" : "\(count) People"
    }

    static let missingRecipientsShareButtonTitle = "Add People to Share"

    static func inviteButtonTitle(
        isSending: Bool,
        pendingCount: Int,
        allInvitesSent: Bool,
        containsSendRetry: Bool,
        containsLookupCheck: Bool
    ) -> String {
        if isSending {
            return containsSendRetry ? "Retrying..." : "Sending..."
        }
        if allInvitesSent {
            return "All Invites Sent"
        }
        guard pendingCount > 0 else {
            return "Send Invite"
        }
        if containsSendRetry, !containsLookupCheck {
            return pendingCount == 1 ? "Retry Invite" : "Retry \(pendingCount) Invites"
        }
        if containsLookupCheck || containsSendRetry {
            return pendingCount == 1 ? "Send Pending Invite" : "Send \(pendingCount) Pending Invites"
        }
        return pendingCount == 1 ? "Send Invite" : "Send \(pendingCount) Invites"
    }

    static func inviteSendStatus(containsSendRetry: Bool) -> String {
        containsSendRetry ? "Retrying invites..." : "Resolving recipients..."
    }

    static func shouldPrioritizeInviteRetry(
        containsSendRetry: Bool,
        didReconnect: Bool
    ) -> Bool {
        containsSendRetry && didReconnect
    }

    static func invitePendingNote(
        visibleCount: Int,
        pendingCount: Int,
        allInvitesSent: Bool
    ) -> String {
        if visibleCount == 0 {
            return "Add at least one recipient to send an invite."
        }
        if allInvitesSent, visibleCount > 0 {
            return "All selected recipients have already been invited."
        }
        guard pendingCount > 0, pendingCount < visibleCount else {
            return ""
        }
        return "Only \(personCountText(pendingCount)) with pending invites will be sent. Already-invited recipients will not get a duplicate invite."
    }

    static func shareButtonTitle(
        isRunning: Bool,
        isSharing: Bool,
        containsSendRetry: Bool,
        containsLookupCheck: Bool,
        shouldRetryLocation: Bool = false,
        allRecipientsCurrent: Bool = false
    ) -> String {
        if isRunning {
            if containsSendRetry {
                return "Retrying..."
            }
            return isSharing ? "Updating..." : "Starting..."
        }
        if allRecipientsCurrent {
            return isSharing ? "All Updates Sent" : "Sharing Started"
        }
        if shouldRetryLocation {
            return "Try Location Again"
        }
        if containsSendRetry, !containsLookupCheck {
            return isSharing ? "Retry Location Update" : "Retry Sharing Start"
        }
        if containsLookupCheck || containsSendRetry {
            return isSharing ? "Send Pending Update" : "Start Pending Sharing"
        }
        return isSharing ? "Update Shared Location" : "Start 2h Sharing Session"
    }

    static func shareActionStatus(
        isSharing: Bool,
        containsSendRetry: Bool,
        containsLookupCheck: Bool
    ) -> String {
        if containsSendRetry, !containsLookupCheck {
            return isSharing ? "Retrying location update..." : "Retrying sharing start..."
        }
        if containsLookupCheck || containsSendRetry {
            return isSharing ? "Sending pending location update..." : "Starting pending sharing..."
        }
        return isSharing ? "Updating shared location..." : "Starting encrypted sharing..."
    }

    static func sharePendingNote(
        isSharing: Bool,
        visibleCount: Int,
        pendingCount: Int
    ) -> String {
        if visibleCount > 0, pendingCount == 0 {
            return isSharing
                ? "All selected recipients already have the latest location update. Add someone new to share with more people."
                : "All selected recipients already have the sharing start. Add someone new to include more people."
        }
        guard pendingCount > 0, pendingCount < visibleCount else {
            return ""
        }
        let action = isSharing ? "location updates" : "sharing starts"
        let duplicateAction = isSharing ? "update" : "sharing start"
        return "Only \(personCountText(pendingCount)) with pending \(action) will be sent. Already-current recipients will not get a duplicate \(duplicateAction)."
    }

    static func shouldRetryLocation(statusLine: String, hasLocationFix: Bool) -> Bool {
        !hasLocationFix && NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(statusLine)
    }

    static func locationRetryNote(shouldRetryLocation: Bool, recipientCount: Int, isSharing: Bool) -> String {
        guard shouldRetryLocation && (recipientCount > 0 || isSharing) else { return "" }
        return "Try location again without changing the people selected."
    }

    static func shareReadinessNote(
        hasLocationFix: Bool,
        isWaitingForLocation: Bool,
        recipientCount: Int,
        isSharing: Bool = false
    ) -> String {
        if recipientCount == 0, !isSharing {
            return "Add at least one recipient before sharing."
        }
        if isWaitingForLocation {
            return "Waiting for iOS to return an approximate area. Cancel keeps people selected."
        }
        if !hasLocationFix {
            return "Find your current location before sharing."
        }
        if recipientCount == 0, isSharing {
            return "Uses the active sharing session. Add people to share with someone new."
        }
        return ""
    }

    static func restoredActiveSessionStatus(recipientCount: Int) -> String {
        guard recipientCount > 0 else {
            return "Restored active sharing. Reconnect relays, then Share Current Area to send the latest approximate area."
        }
        return "Restored active sharing with \(personCountText(recipientCount)). Reconnect relays, then Share Current Area to send the latest approximate area."
    }

    static func locationWaitCanceledText() -> String {
        "Location request canceled. People stay selected for sharing later."
    }

    static func shareSheetButtonTitle(isSharing: Bool) -> String {
        isSharing ? "Share Current Area" : "Start Sharing"
    }

    static func shareSheetButtonTitle(
        isSharing: Bool,
        containsSendRetry: Bool,
        containsLookupCheck: Bool,
        allRecipientsCurrent: Bool = false
    ) -> String {
        if allRecipientsCurrent {
            return isSharing ? "All Updates Sent" : "Sharing Started"
        }
        if containsSendRetry, !containsLookupCheck {
            return isSharing ? "Retry Location Update" : "Retry Sharing Start"
        }
        if containsLookupCheck || containsSendRetry {
            return isSharing ? "Send Pending Update" : "Start Pending Sharing"
        }
        return shareSheetButtonTitle(isSharing: isSharing)
    }

    static func shareStartSheetNote(recipientCount: Int, isSendingInvite: Bool, isSharing: Bool = false) -> String {
        if recipientCount == 0 {
            return isSharing
                ? "Add at least one recipient before sharing your current area."
                : "Add at least one recipient before starting sharing."
        }
        if isSendingInvite {
            return isSharing
                ? "Finish sending invites before sharing your current area."
                : "Finish sending invites before starting sharing."
        }
        if isSharing {
            return "Sends the latest approximate area to \(personCountText(recipientCount))."
        }
        return "Starts a 2-hour sharing session with \(personCountText(recipientCount))."
    }

    private static func personCountText(_ count: Int) -> String {
        "\(count) \(count == 1 ? "person" : "people")"
    }
}
