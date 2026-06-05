import Foundation

enum NostrWireCodec {
    private static let hexCharset = CharacterSet(charactersIn: "0123456789abcdef")
    private static let maxContentBytes = 64 * 1024
    private static let maxTagCount = 100
    private static let maxTagElements = 12
    private static let maxTagValueBytes = 1024
    private static let futureSkewSeconds = 24 * 60 * 60

    static func eventDictionary(from event: NostrEvent) -> [String: Any] {
        [
            "id": event.id,
            "pubkey": event.pubkey,
            "created_at": event.createdAt,
            "kind": event.kind,
            "tags": event.tags,
            "content": event.content,
            "sig": event.sig
        ]
    }

    static func event(from jsonObject: Any) -> NostrEvent? {
        guard let dict = jsonObject as? [String: Any] else { return nil }
        guard let id = dict["id"] as? String,
              let pubkey = dict["pubkey"] as? String,
              let kind = dict["kind"] as? Int,
              let content = dict["content"] as? String,
              let sig = dict["sig"] as? String else {
            return nil
        }

        let createdAt: Int
        if let value = dict["created_at"] as? Int {
            createdAt = value
        } else if let value = dict["createdAt"] as? Int {
            createdAt = value
        } else {
            return nil
        }

        let tags = (dict["tags"] as? [[String]]) ?? []
        let event = NostrEvent(
            id: id,
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind,
            tags: tags,
            content: content,
            sig: sig
        )
        guard createdAt > 0,
              kind >= 0,
              createdAt <= Int(Date().timeIntervalSince1970) + futureSkewSeconds,
              content.utf8.count <= maxContentBytes,
              areTagsReasonable(tags),
              isValidHex(id, length: 64),
              isValidHex(pubkey, length: 64),
              isValidHex(sig, length: 128),
              NIP01.hasValidEventID(event) else {
            return nil
        }
        return event
    }

    private static func isValidHex(_ value: String, length: Int) -> Bool {
        guard value.count == length else { return false }
        return value.lowercased().unicodeScalars.allSatisfy { hexCharset.contains($0) }
    }

    private static func areTagsReasonable(_ tags: [[String]]) -> Bool {
        guard tags.count <= maxTagCount else { return false }
        for tag in tags {
            guard !tag.isEmpty, tag.count <= maxTagElements else { return false }
            for value in tag where value.utf8.count > maxTagValueBytes {
                return false
            }
        }
        return true
    }
}
