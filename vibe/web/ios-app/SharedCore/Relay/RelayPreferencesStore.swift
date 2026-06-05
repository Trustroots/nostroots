import Foundation

protocol RelayPreferencesStoring {
    func load(defaults: [NRConstants.RelayEndpoint]) -> [NRConstants.RelayEndpoint]
    func save(_ endpoints: [NRConstants.RelayEndpoint])
}

protocol RelayConnectionFailureCountStoring {
    func loadConnectionFailureCounts() -> [URL: Int]
    func saveConnectionFailureCounts(_ counts: [URL: Int])
    func clearConnectionFailureCounts()
}

final class UserDefaultsRelayPreferencesStore: RelayPreferencesStoring {
    private struct PersistedRelay: Codable, Equatable {
        let url: String
        let readEnabled: Bool
        let writeEnabled: Bool
        let requiresNIP42Auth: Bool
    }

    private struct PersistedConnectionFailureCount: Codable, Equatable {
        let url: String
        let count: Int
    }

    private let defaults: UserDefaults
    private let key = "nr.ios.relay.preferences.v1"
    private let failureCountsKey = "nr.ios.relay.connectionFailureCounts.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(defaults defaultEndpoints: [NRConstants.RelayEndpoint]) -> [NRConstants.RelayEndpoint] {
        guard let data = defaults.data(forKey: key) else {
            return defaultEndpoints
        }
        guard let persisted = try? JSONDecoder().decode([PersistedRelay].self, from: data) else {
            defaults.removeObject(forKey: key)
            return defaultEndpoints
        }

        let persistedByURL = persisted.reduce(into: [URL: PersistedRelay]()) { values, relay in
            guard let url = try? RelayEndpointInput.normalizedURL(from: relay.url) else {
                return
            }
            values[url] = relay
        }
        let defaultURLs = Set(defaultEndpoints.map(\.url))
        let mergedDefaults = defaultEndpoints.map { endpoint in
            guard let value = persistedByURL[endpoint.url] else { return endpoint }
            return NRConstants.RelayEndpoint(
                url: endpoint.url,
                readEnabled: value.readEnabled,
                writeEnabled: value.writeEnabled,
                requiresNIP42Auth: endpoint.requiresNIP42Auth
            )
        }
        var seenCustomURLs = Set<URL>()
        let customEndpoints = persisted.compactMap { relay -> NRConstants.RelayEndpoint? in
            guard let url = try? RelayEndpointInput.normalizedURL(from: relay.url),
                  !defaultURLs.contains(url) else {
                return nil
            }
            guard !seenCustomURLs.contains(url) else {
                return nil
            }
            seenCustomURLs.insert(url)
            return NRConstants.RelayEndpoint(
                url: url,
                readEnabled: relay.readEnabled,
                writeEnabled: relay.writeEnabled,
                requiresNIP42Auth: relay.requiresNIP42Auth
            )
        }
        let sanitizedEndpoints = mergedDefaults + customEndpoints
        if Self.persistedRelays(from: sanitizedEndpoints) != persisted {
            save(sanitizedEndpoints)
        }
        return sanitizedEndpoints
    }

    func save(_ endpoints: [NRConstants.RelayEndpoint]) {
        let payload = Self.persistedRelays(from: endpoints)
        if let data = try? JSONEncoder().encode(payload) {
            defaults.set(data, forKey: key)
        }
    }

    private static func persistedRelays(from endpoints: [NRConstants.RelayEndpoint]) -> [PersistedRelay] {
        endpoints.map {
            PersistedRelay(
                url: $0.url.absoluteString,
                readEnabled: $0.readEnabled,
                writeEnabled: $0.writeEnabled,
                requiresNIP42Auth: $0.requiresNIP42Auth
            )
        }
    }
}

extension UserDefaultsRelayPreferencesStore: RelayConnectionFailureCountStoring {
    func loadConnectionFailureCounts() -> [URL: Int] {
        guard let data = defaults.data(forKey: failureCountsKey) else {
            return [:]
        }
        guard let persisted = try? JSONDecoder().decode([PersistedConnectionFailureCount].self, from: data) else {
            clearConnectionFailureCounts()
            return [:]
        }
        let sanitizedCounts = persisted.reduce(into: [URL: Int]()) { counts, record in
            guard record.count > 0,
                  let url = try? RelayEndpointInput.normalizedURL(from: record.url) else {
                return
            }
            counts[url] = record.count
        }
        if Self.persistedConnectionFailureCounts(from: sanitizedCounts) != persisted {
            saveConnectionFailureCounts(sanitizedCounts)
        }
        return sanitizedCounts
    }

    func saveConnectionFailureCounts(_ counts: [URL: Int]) {
        let payload = Self.persistedConnectionFailureCounts(from: counts)
        guard !payload.isEmpty else {
            clearConnectionFailureCounts()
            return
        }
        if let data = try? JSONEncoder().encode(payload) {
            defaults.set(data, forKey: failureCountsKey)
        }
    }

    func clearConnectionFailureCounts() {
        defaults.removeObject(forKey: failureCountsKey)
    }

    private static func persistedConnectionFailureCounts(from counts: [URL: Int]) -> [PersistedConnectionFailureCount] {
        counts
            .filter { $0.value > 0 }
            .map {
                PersistedConnectionFailureCount(
                    url: $0.key.absoluteString,
                    count: $0.value
                )
            }
            .sorted { $0.url < $1.url }
    }
}
