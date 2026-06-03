import Foundation

struct StoredLocationRecord: Codable, Equatable, Identifiable {
    let id: String
    let fromPubkey: String
    let location: LocationEventPayload
    let receivedAt: Int
}

protocol AppStorage {
    func save(record: StoredLocationRecord)
    func allLocationRecords() -> [StoredLocationRecord]
    func removeExpired(nowUnix: Int)
    func removeLocationRecords(sessionId: String, fromPubkey: String)
    func removeAll()
}

final class InMemoryAppStorage: AppStorage {
    private var records: [StoredLocationRecord] = []
    private let maxRecords: Int

    init(maxRecords: Int = 1_000) {
        self.maxRecords = max(1, maxRecords)
    }

    func save(record: StoredLocationRecord) {
        records.removeAll { $0.id == record.id }
        records.append(record)
        trimToLimit()
    }

    func allLocationRecords() -> [StoredLocationRecord] {
        records.sorted { $0.location.createdAt > $1.location.createdAt }
    }

    func removeExpired(nowUnix: Int = Int(Date().timeIntervalSince1970)) {
        records.removeAll { $0.location.expiresAt <= nowUnix }
    }

    func removeLocationRecords(sessionId: String, fromPubkey: String) {
        records.removeAll { record in
            record.location.sessionId == sessionId && record.fromPubkey == fromPubkey
        }
    }

    func removeAll() {
        records.removeAll()
    }

    private func trimToLimit() {
        guard records.count > maxRecords else { return }
        records.sort { $0.location.createdAt > $1.location.createdAt }
        records.removeLast(records.count - maxRecords)
    }
}

final class UserDefaultsAppStorage: AppStorage {
    private let defaults: UserDefaults
    private let key: String
    private let maxRecords: Int

    init(
        defaults: UserDefaults = .standard,
        key: String = "nr.ios.location.records.v1",
        maxRecords: Int = 1_000
    ) {
        self.defaults = defaults
        self.key = key
        self.maxRecords = max(1, maxRecords)
    }

    func save(record: StoredLocationRecord) {
        var records = loadRecords()
        records.removeAll { $0.id == record.id }
        records.append(record)
        saveRecords(trimmed(records))
    }

    func allLocationRecords() -> [StoredLocationRecord] {
        sorted(loadRecords())
    }

    func removeExpired(nowUnix: Int = Int(Date().timeIntervalSince1970)) {
        saveRecords(loadRecords().filter { $0.location.expiresAt > nowUnix })
    }

    func removeLocationRecords(sessionId: String, fromPubkey: String) {
        let records = loadRecords().filter { record in
            record.location.sessionId != sessionId || record.fromPubkey != fromPubkey
        }
        saveRecords(records)
    }

    func removeAll() {
        defaults.removeObject(forKey: key)
    }

    private func loadRecords() -> [StoredLocationRecord] {
        guard let data = defaults.data(forKey: key),
              let records = try? JSONDecoder().decode([StoredLocationRecord].self, from: data) else {
            return []
        }
        return records
    }

    private func saveRecords(_ records: [StoredLocationRecord]) {
        let cleanRecords = trimmed(records)
        guard !cleanRecords.isEmpty else {
            removeAll()
            return
        }
        if let data = try? JSONEncoder().encode(cleanRecords) {
            defaults.set(data, forKey: key)
        }
    }

    private func sorted(_ records: [StoredLocationRecord]) -> [StoredLocationRecord] {
        records.sorted { $0.location.createdAt > $1.location.createdAt }
    }

    private func trimmed(_ records: [StoredLocationRecord]) -> [StoredLocationRecord] {
        let records = sorted(records)
        guard records.count > maxRecords else { return records }
        return Array(records.prefix(maxRecords))
    }
}
