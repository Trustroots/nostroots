import Foundation

struct NormalizedRecipientInput: Equatable {
    let displayText: String
    let duplicateKey: String
}

struct RecipientBatchNormalizationResult: Equatable {
    var added: [NormalizedRecipientInput] = []
    var duplicates: [String] = []
    var invalidInputs: [String] = []

    var hasChanges: Bool {
        !added.isEmpty
    }

    var hasFeedback: Bool {
        !added.isEmpty || !duplicates.isEmpty || !invalidInputs.isEmpty
    }
}

enum RecipientInputError: Error, LocalizedError, Equatable {
    case empty
    case invalidFormat

    var errorDescription: String? {
        switch self {
        case .empty:
            return "Enter a recipient."
        case .invalidFormat:
            return "Use a Trustroots username, profile link, NIP-05 address, npub, or public key."
        }
    }
}

enum RecipientInputNormalizer {
    static func normalize(_ raw: String) throws -> NormalizedRecipientInput {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw RecipientInputError.empty
        }

        let lowercased = trimmed.lowercased()
        if let pubkey = try? NIP19.importPubkey(lowercased) {
            return NormalizedRecipientInput(displayText: lowercased, duplicateKey: "pubkey:\(pubkey)")
        }

        if lowercased.hasPrefix("npub1") || NIP19.isValidHex(lowercased, expectedBytes: 32) {
            throw RecipientInputError.invalidFormat
        }

        if trimmed.hasPrefix("@") || !trimmed.contains("@") {
            let handle = try TrustrootsUsername.nip05(trimmed)
            let username = handle.replacingOccurrences(of: "@trustroots.org", with: "")
            let display = trimmed.hasPrefix("@") ? "@\(username)" : username
            return NormalizedRecipientInput(displayText: display, duplicateKey: "nip05:\(handle)")
        }

        guard isLikelyNip05(lowercased) else {
            throw RecipientInputError.invalidFormat
        }

        if let username = try? TrustrootsUsername.normalize(lowercased) {
            return NormalizedRecipientInput(
                displayText: "\(username)@trustroots.org",
                duplicateKey: "nip05:\(username)@trustroots.org"
            )
        }

        return NormalizedRecipientInput(displayText: lowercased, duplicateKey: "nip05:\(lowercased)")
    }

    private static func isLikelyNip05(_ value: String) -> Bool {
        value.range(of: #"^[^@\s/]+@[^@\s/]+\.[^@\s/]+$"#, options: .regularExpression) != nil
    }
}

enum RecipientBatchInputNormalizer {
    static func normalizeMany(_ raw: String, existingRecipients: [String]) -> RecipientBatchNormalizationResult {
        var result = RecipientBatchNormalizationResult()
        var knownKeys = Set(existingRecipients.compactMap { try? RecipientInputNormalizer.normalize($0).duplicateKey })

        for token in split(raw) {
            do {
                let normalized = try RecipientInputNormalizer.normalize(token)
                if knownKeys.contains(normalized.duplicateKey) {
                    result.duplicates.append(normalized.displayText)
                } else {
                    knownKeys.insert(normalized.duplicateKey)
                    result.added.append(normalized)
                }
            } catch {
                result.invalidInputs.append(token)
            }
        }

        return result
    }

    static func split(_ raw: String) -> [String] {
        raw.split { character in
            character.isWhitespace || character == "," || character == ";"
        }
        .map(String.init)
    }
}
