import Foundation

enum RelayEndpointInputError: Error, LocalizedError, Equatable {
    case empty
    case invalidURL
    case unsupportedScheme
    case missingHost
    case duplicate
    case notFound
    case cannotRemoveBuiltIn
    case relaySettingsUnavailable

    var errorDescription: String? {
        switch self {
        case .empty:
            return "Enter a relay address before adding it."
        case .invalidURL:
            return "Enter a valid relay address."
        case .unsupportedScheme:
            return "Relay addresses must start with wss:// or ws://."
        case .missingHost:
            return "Relay addresses need a host name."
        case .duplicate:
            return "That relay is already in Settings."
        case .notFound:
            return "That relay is not in Settings."
        case .cannotRemoveBuiltIn:
            return "Built-in relays can be turned off, but not removed."
        case .relaySettingsUnavailable:
            return "Relay settings are unavailable in this build."
        }
    }
}

enum RelayEndpointInput {
    static func normalizedURL(from input: String) throws -> URL {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw RelayEndpointInputError.empty }

        let candidate = trimmed.contains("://") ? trimmed : "wss://\(trimmed)"
        guard var components = URLComponents(string: candidate) else {
            throw RelayEndpointInputError.invalidURL
        }

        guard let scheme = components.scheme?.lowercased() else {
            throw RelayEndpointInputError.unsupportedScheme
        }
        guard scheme == "wss" || scheme == "ws" else {
            throw RelayEndpointInputError.unsupportedScheme
        }
        guard let host = components.host?.trimmingCharacters(in: .whitespacesAndNewlines),
              !host.isEmpty else {
            throw RelayEndpointInputError.missingHost
        }

        components.scheme = scheme
        guard let url = components.url else {
            throw RelayEndpointInputError.invalidURL
        }
        return url
    }

    static func isBuiltInRelay(_ url: URL) -> Bool {
        NRConstants.defaultRelayEndpoints.contains { $0.url == url }
    }
}
