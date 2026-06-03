import Foundation

enum TrustrootsUsernameError: Error, LocalizedError, Equatable {
    case empty
    case unsupportedDomain
    case invalidFormat

    var errorDescription: String? {
        switch self {
        case .empty:
            return "Enter your Trustroots username."
        case .unsupportedDomain:
            return "Use your Trustroots username, username@trustroots.org, or Trustroots profile link."
        case .invalidFormat:
            return "Use only letters, numbers, dots, underscores, or hyphens."
        }
    }
}

enum TrustrootsUsername {
    private static let allowedPattern = #"^[a-z0-9][a-z0-9_.-]{0,63}$"#

    static func normalize(_ raw: String) throws -> String {
        var value = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        if let username = try normalizedProfileURL(value) {
            value = username
        }

        if value.hasPrefix("@") {
            value.removeFirst()
        }

        guard !value.isEmpty else {
            throw TrustrootsUsernameError.empty
        }

        if value.contains("@") {
            let parts = value.split(separator: "@", omittingEmptySubsequences: false)
            guard parts.count == 2 else {
                throw TrustrootsUsernameError.unsupportedDomain
            }
            let domain = parts[1].replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression)
            guard domain == "trustroots.org" else {
                throw TrustrootsUsernameError.unsupportedDomain
            }
            value = String(parts[0])
        }

        guard !value.isEmpty, !value.contains("@") else {
            throw TrustrootsUsernameError.empty
        }
        guard value.range(of: allowedPattern, options: .regularExpression) != nil else {
            throw TrustrootsUsernameError.invalidFormat
        }
        return value
    }

    static func nip05(_ username: String) throws -> String {
        "\(try normalize(username))@trustroots.org"
    }

    private static func normalizedProfileURL(_ value: String) throws -> String? {
        let hasExplicitScheme = value.hasPrefix("https://") || value.hasPrefix("http://")
        let isBareTrustrootsURL = value.hasPrefix("trustroots.org/") || value.hasPrefix("www.trustroots.org/")
        guard hasExplicitScheme || isBareTrustrootsURL else {
            return nil
        }

        let urlString = hasExplicitScheme ? value : "https://\(value)"
        guard let components = URLComponents(string: urlString),
              let host = components.host?.replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression) else {
            throw TrustrootsUsernameError.invalidFormat
        }
        guard host == "trustroots.org" else {
            throw TrustrootsUsernameError.unsupportedDomain
        }

        let pathParts = components.path
            .split(separator: "/", omittingEmptySubsequences: true)
            .map(String.init)
        guard pathParts.count == 2, pathParts[0] == "profile" else {
            throw TrustrootsUsernameError.invalidFormat
        }
        return pathParts[1]
    }
}
