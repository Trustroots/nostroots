import Foundation

enum NostrailRecipientFeedbackFormatter {
    static func personCountText(_ count: Int) -> String {
        "\(count) \(count == 1 ? "person" : "people")"
    }

    static func attentionText(_ failedInputs: [String]) -> String {
        guard !failedInputs.isEmpty else { return "" }
        return "Check \(listText(failedInputs)), then try again."
    }

    static func sendRetryText(_ failedInputs: [String]) -> String {
        guard !failedInputs.isEmpty else { return "" }
        return "Reconnect, then retry \(listText(failedInputs))."
    }

    static func combinedFailureText(lookupInputs: [String], sendInputs: [String]) -> String {
        [attentionText(lookupInputs), sendRetryText(sendInputs)]
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    static func failureSummaryText(lookupInputs: [String], sendInputs: [String]) -> String {
        switch (lookupInputs.count, sendInputs.count) {
        case (0, 0):
            return ""
        case (let lookupCount, 0):
            return "Check \(personCountText(lookupCount)) below."
        case (0, let sendCount):
            return "Reconnect, then retry \(personCountText(sendCount))."
        default:
            return "Some recipients need checking or retrying."
        }
    }

    private static func listText(_ failedInputs: [String]) -> String {
        let visibleInputs = failedInputs.prefix(3).joined(separator: ", ")
        let remainingCount = failedInputs.count - 3
        return remainingCount > 0 ? "\(visibleInputs), +\(remainingCount) more" : visibleInputs
    }

    static func statusText(successText: String, failedInputs: [String]) -> String {
        let attention = attentionText(failedInputs)
        guard !attention.isEmpty else { return successText }
        return "\(successText) \(attention)"
    }

    static func shouldClearTransientStatusWhileEditing(_ statusText: String) -> Bool {
        statusText == "Clipboard is empty." ||
            statusText == "Recipient copied." ||
            statusText == "Recipient removed." ||
            statusText.hasPrefix("Could not") ||
            statusText.hasPrefix("Added") ||
            statusText.hasPrefix("Already added") ||
            statusText.hasPrefix("Check ") ||
            statusText.hasPrefix("Edit the recipient") ||
            statusText.hasPrefix("Some recipients") ||
            statusText.contains("recipients removed") ||
            statusText.contains("then try again") ||
            statusText.contains("Reconnect, then retry") ||
            statusText.contains("need checking or retrying") ||
            statusText.contains("already in the recipient list")
    }
}
