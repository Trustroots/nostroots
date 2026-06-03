import Foundation
import CryptoKit

typealias NostrTag = [String]

struct UnsignedNostrEvent: Codable, Equatable {
    let pubkey: String
    let createdAt: Int
    let kind: Int
    let tags: [NostrTag]
    let content: String

    enum CodingKeys: String, CodingKey {
        case pubkey
        case createdAt = "created_at"
        case kind
        case tags
        case content
    }
}

struct NostrEvent: Codable, Equatable, Identifiable {
    let id: String
    let pubkey: String
    let createdAt: Int
    let kind: Int
    let tags: [NostrTag]
    let content: String
    let sig: String

    enum CodingKeys: String, CodingKey {
        case id
        case pubkey
        case createdAt = "created_at"
        case kind
        case tags
        case content
        case sig
    }

    var expirationUnix: Int? {
        guard let raw = tags.first(where: { $0.first == "expiration" })?.dropFirst().first else {
            return nil
        }
        return Int(raw)
    }

    var isExpired: Bool {
        guard let expirationUnix else { return false }
        return expirationUnix <= Int(Date().timeIntervalSince1970)
    }

    var recipients: [String] {
        tags.compactMap { tag in
            guard tag.first == "p", tag.count > 1 else { return nil }
            return tag[1]
        }
    }
}

enum NostrEventFactory {
    static func makeUnsigned(
        pubkey: String,
        kind: Int,
        tags: [NostrTag],
        content: String,
        createdAt: Date = .now
    ) -> UnsignedNostrEvent {
        UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: Int(createdAt.timeIntervalSince1970),
            kind: kind,
            tags: tags,
            content: content
        )
    }
}

enum NIP01 {
    static func serialize(_ event: UnsignedNostrEvent) throws -> Data {
        let payload: [Any] = [0, event.pubkey, event.createdAt, event.kind, event.tags, event.content]
        return try JSONSerialization.data(withJSONObject: payload, options: [.withoutEscapingSlashes])
    }

    static func eventIDHex(for event: UnsignedNostrEvent) throws -> String {
        let serialized = try serialize(event)
        let digest = SHA256.hash(data: serialized)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    static func hasValidEventID(_ event: NostrEvent) -> Bool {
        let unsigned = UnsignedNostrEvent(
            pubkey: event.pubkey,
            createdAt: event.createdAt,
            kind: event.kind,
            tags: event.tags,
            content: event.content
        )
        guard let expected = try? eventIDHex(for: unsigned) else { return false }
        return expected == event.id
    }
}
