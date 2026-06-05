import Foundation

protocol Nip05Resolving {
    func resolve(_ handle: String) async throws -> String
}

enum Nip05ResolverError: Error, LocalizedError {
    case invalidHandle
    case invalidURL
    case invalidResponse
    case httpStatus(Int)
    case nameNotFound(String)
    case invalidPubkey

    var errorDescription: String? {
        switch self {
        case .invalidHandle:
            return "Use a handle like name@domain.tld."
        case .invalidURL:
            return "Could not build a NIP-05 lookup URL."
        case .invalidResponse:
            return "Invalid NIP-05 response from server."
        case .httpStatus(let status):
            return "NIP-05 lookup failed with HTTP \(status)."
        case .nameNotFound(let name):
            return "NIP-05 name '\(name)' was not found."
        case .invalidPubkey:
            return "NIP-05 response contained an invalid pubkey."
        }
    }
}

final class Nip05Resolver: Nip05Resolving {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func resolve(_ handle: String) async throws -> String {
        let (name, domain) = try parse(handle: handle)
        guard var components = URLComponents(string: "https://\(domain)") else {
            throw Nip05ResolverError.invalidURL
        }
        components.path = "/.well-known/nostr.json"
        components.queryItems = [URLQueryItem(name: "name", value: name)]
        guard let url = components.url else {
            throw Nip05ResolverError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw Nip05ResolverError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            throw Nip05ResolverError.httpStatus(http.statusCode)
        }
        guard let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let names = payload["names"] as? [String: Any] else {
            throw Nip05ResolverError.invalidResponse
        }

        let rawValue = (names[name] as? String) ?? (names[name.lowercased()] as? String)
        guard let pubkey = rawValue?.lowercased() else {
            throw Nip05ResolverError.nameNotFound(name)
        }
        guard NIP19.isValidHex(pubkey, expectedBytes: 32) else {
            throw Nip05ResolverError.invalidPubkey
        }
        return pubkey
    }

    private func parse(handle: String) throws -> (name: String, domain: String) {
        let cleaned = handle.trimmingCharacters(in: .whitespacesAndNewlines)
        let pieces = cleaned.split(separator: "@", omittingEmptySubsequences: false)
        guard pieces.count == 2 else { throw Nip05ResolverError.invalidHandle }
        let name = String(pieces[0])
        let domain = String(pieces[1]).lowercased()
        guard !name.isEmpty, !domain.isEmpty else {
            throw Nip05ResolverError.invalidHandle
        }
        return (name, domain)
    }
}
