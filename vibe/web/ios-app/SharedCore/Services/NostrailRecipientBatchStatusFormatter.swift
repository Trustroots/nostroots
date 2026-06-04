import Foundation

enum NostrailRecipientBatchStatusFormatter {
    static func statusText(for result: RecipientBatchNormalizationResult) -> String {
        if result.added.isEmpty, result.duplicates.isEmpty, result.invalidInputs.isEmpty {
            return "Enter a recipient."
        }

        var parts: [String] = []
        if !result.added.isEmpty {
            let count = result.added.count
            parts.append("Added \(count) recipient\(count == 1 ? "" : "s").")
        }
        if !result.duplicates.isEmpty {
            parts.append("Already added: \(listText(result.duplicates)).")
        }
        if !result.invalidInputs.isEmpty {
            parts.append("Could not add: \(listText(result.invalidInputs)). \(RecipientInputError.invalidFormat.localizedDescription)")
        }
        return parts.joined(separator: " ")
    }

    private static func listText(_ inputs: [String]) -> String {
        let visibleInputs = inputs.prefix(3).joined(separator: ", ")
        let remainingCount = inputs.count - 3
        return remainingCount > 0 ? "\(visibleInputs), +\(remainingCount) more" : visibleInputs
    }
}
