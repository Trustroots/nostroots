import Foundation

enum RecipientRowStatePurpose: Equatable {
    case invite
    case shareRetry
}

enum RecipientRowDisplayStatus: Equatable {
    case none
    case check
    case retry
    case sent(String)

    var label: String? {
        switch self {
        case .none:
            return nil
        case .check:
            return "Check"
        case .retry:
            return "Retry"
        case .sent(let value):
            return value
        }
    }

    var systemImage: String? {
        switch self {
        case .none:
            return nil
        case .check:
            return "exclamationmark.circle.fill"
        case .retry:
            return "arrow.clockwise.circle.fill"
        case .sent:
            return "checkmark.circle.fill"
        }
    }

    var accessibilityLabel: String? {
        switch self {
        case .none:
            return nil
        case .check:
            return "Needs checking"
        case .retry:
            return "Needs retry"
        case .sent(let value):
            return value
        }
    }

    var detailText: String? {
        detailText(didReconnect: false)
    }

    func detailText(didReconnect: Bool) -> String? {
        switch self {
        case .none, .sent:
            return nil
        case .check:
            return "Tap edit or remove this recipient."
        case .retry:
            return didReconnect ? "Retry this recipient." : "Reconnect, then retry."
        }
    }
}

struct RecipientRowState: Equatable {
    var needingAttention = Set<String>()
    var needingRetry = Set<String>()
    var sent = Set<String>()
    var purpose: RecipientRowStatePurpose?

    var sentLabel: String {
        purpose == .shareRetry ? "Updated" : "Sent"
    }

    mutating func markPublishResult(
        attemptedRecipients: [String],
        failedInputs: [String],
        purpose nextPurpose: RecipientRowStatePurpose
    ) {
        markPublishResult(
            attemptedRecipients: attemptedRecipients,
            failedLookupInputs: failedInputs,
            failedSendInputs: [],
            purpose: nextPurpose
        )
    }

    mutating func markPublishResult(
        attemptedRecipients: [String],
        failedLookupInputs: [String],
        failedSendInputs: [String],
        purpose nextPurpose: RecipientRowStatePurpose
    ) {
        if purpose != nextPurpose {
            sent = []
        }
        purpose = nextPurpose

        needingAttention = Set(failedLookupInputs)
        needingRetry = Set(failedSendInputs)
        let failed = needingAttention.union(needingRetry)
        sent.formUnion(Set(attemptedRecipients).subtracting(failed))
        sent.subtract(failed)
    }

    mutating func clear() {
        needingAttention = []
        needingRetry = []
        sent = []
        purpose = nil
    }

    @discardableResult
    mutating func clearShareRetryState() -> Bool {
        guard purpose == .shareRetry else { return false }
        clear()
        return true
    }

    mutating func prune(to recipients: [String]) {
        let visibleRecipients = Set(recipients)
        guard !visibleRecipients.isEmpty else {
            clear()
            return
        }
        needingAttention.formIntersection(visibleRecipients)
        needingRetry.formIntersection(visibleRecipients)
        sent.formIntersection(visibleRecipients)
    }

    func inviteRetryRecipients(from recipients: [String]) -> [String] {
        guard purpose == .invite else {
            return recipients
        }
        return recipients.filter { !sent.contains($0) }
    }

    func shareRetryRecipients(from recipients: [String]) -> [String] {
        guard purpose == .shareRetry else {
            return recipients
        }
        return recipients.filter { !sent.contains($0) }
    }

    func displayStatus(for recipient: String) -> RecipientRowDisplayStatus {
        if needingAttention.contains(recipient) {
            return .check
        }
        if needingRetry.contains(recipient) {
            return .retry
        }
        if sent.contains(recipient) {
            return .sent(sentLabel)
        }
        return .none
    }
}
