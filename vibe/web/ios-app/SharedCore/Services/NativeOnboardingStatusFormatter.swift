enum NativeOnboardingStatusFormatter {
    static func isErrorStatus(_ statusText: String) -> Bool {
        let text = statusText.trimmingCharacters(in: .whitespacesAndNewlines)
        return [
            "Could not",
            "That",
            "Invalid",
            "Enter",
            "You pasted",
            "We could not",
            "No key",
            "Stop sharing",
            "Finish stopping",
            "Clipboard",
        ].contains { text.hasPrefix($0) }
    }

    static func shouldClearTransientStatusWhileEditing(_ statusText: String) -> Bool {
        let text = statusText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        if isErrorStatus(text) { return true }
        return [
            "Add your Trustroots username to finish setup.",
            "nsec copied.",
            "npub copied. Add it to your Trustroots Networks page.",
            "Opening Trustroots Networks...",
        ].contains(text)
    }
}
