import Foundation

struct LocationEventPayload: Codable, Equatable {
    let type: String
    let sessionId: String
    let area: String
    let centerLat: Double
    let centerLon: Double
    let accuracyM: Double
    let createdAt: Int
    let expiresAt: Int

    init(
        sessionId: String,
        area: String,
        centerLat: Double,
        centerLon: Double,
        accuracyM: Double,
        createdAt: Int,
        expiresAt: Int
    ) {
        self.type = "trustroots.location.v1"
        self.sessionId = sessionId
        self.area = area
        self.centerLat = centerLat
        self.centerLon = centerLon
        self.accuracyM = accuracyM
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

struct InviteEventPayload: Codable, Equatable {
    let type: String
    let message: String
    let createdAt: Int

    init(message: String, createdAt: Int) {
        self.type = "trustroots.location.invite.v1"
        self.message = message
        self.createdAt = createdAt
    }
}

struct StopEventPayload: Codable, Equatable {
    let type: String
    let sessionId: String
    let createdAt: Int

    init(sessionId: String, createdAt: Int) {
        self.type = "trustroots.location.stop.v1"
        self.sessionId = sessionId
        self.createdAt = createdAt
    }
}

enum NostrailPayload: Equatable {
    case location(LocationEventPayload)
    case invite(InviteEventPayload)
    case stop(StopEventPayload)

    var type: String {
        switch self {
        case .location(let payload): return payload.type
        case .invite(let payload): return payload.type
        case .stop(let payload): return payload.type
        }
    }
}

enum NostrailPayloadCodec {
    static func decode(_ content: String) -> NostrailPayload? {
        guard let data = content.data(using: .utf8) else { return nil }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let type = object["type"] as? String else { return nil }

        let decoder = JSONDecoder()
        switch type {
        case "trustroots.location.v1":
            guard let decoded = try? decoder.decode(LocationEventPayload.self, from: data) else { return nil }
            return .location(decoded)
        case "trustroots.location.invite.v1":
            guard let decoded = try? decoder.decode(InviteEventPayload.self, from: data) else { return nil }
            return .invite(decoded)
        case "trustroots.location.stop.v1":
            guard let decoded = try? decoder.decode(StopEventPayload.self, from: data) else { return nil }
            return .stop(decoded)
        default:
            return nil
        }
    }

    static func encode(_ payload: NostrailPayload) throws -> String {
        let encoder = JSONEncoder()
        let data: Data
        switch payload {
        case .location(let location):
            data = try encoder.encode(location)
        case .invite(let invite):
            data = try encoder.encode(invite)
        case .stop(let stop):
            data = try encoder.encode(stop)
        }
        guard let text = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "NostrailPayloadCodec", code: 1, userInfo: [NSLocalizedDescriptionKey: "Encoding failed"])
        }
        return text
    }
}

