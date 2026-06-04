import Foundation

enum RelayPoolError: Error, LocalizedError {
    case connectFailed([String])
    case noEnabledRelays
    case noReadableRelays
    case noWritableRelays
    case publishFailed([String])
    case subscribeFailed([String])

    var errorDescription: String? {
        switch self {
        case .connectFailed(let reasons):
            return "Could not reach any enabled relay: \(reasons.joined(separator: " | "))"
        case .noEnabledRelays:
            return "All relays are turned off."
        case .noReadableRelays:
            return "No readable relays are enabled."
        case .noWritableRelays:
            return "No writable relays are enabled."
        case .publishFailed(let reasons):
            return "Publish failed on all relays: \(reasons.joined(separator: " | "))"
        case .subscribeFailed(let reasons):
            return "Subscribe failed on all relays: \(reasons.joined(separator: " | "))"
        }
    }
}

final class RelayPoolClient: RelayClient, RelayRuntimeResetting {
    struct Entry {
        var endpoint: NRConstants.RelayEndpoint
        let client: RelayClient
    }

    let relayURL: URL
    private(set) var isAuthenticated = false
    private var entries: [Entry]
    private let defaultEndpoints: [NRConstants.RelayEndpoint]
    private let preferencesStore: RelayPreferencesStoring?
    private var continuation: AsyncStream<NostrEvent>.Continuation?
    private var readTasks: [Task<Void, Never>] = []
    private var seenEventIDs = Set<String>()
    private let stateLock = NSLock()
    private let maxSeenIDs = 5000
    private var connectionCheckResults: [URL: RelayConnectionCheckResult] = [:]
    private var consecutiveConnectionFailures: [URL: Int] = [:]

    lazy var incomingEvents: AsyncStream<NostrEvent> = AsyncStream { continuation in
        self.continuation = continuation
    }

    init(
        endpoints: [NRConstants.RelayEndpoint] = NRConstants.defaultRelayEndpoints,
        preferencesStore: RelayPreferencesStoring? = UserDefaultsRelayPreferencesStore()
    ) {
        self.defaultEndpoints = endpoints
        self.preferencesStore = preferencesStore
        let effectiveEndpoints = preferencesStore?.load(defaults: endpoints) ?? endpoints
        self.entries = effectiveEndpoints.map(Self.makeEntry(endpoint:))
        self.relayURL = effectiveEndpoints.first?.url ?? NRConstants.defaultRelayURL
        self.consecutiveConnectionFailures = Self.sanitizedConnectionFailureCounts(
            from: preferencesStore,
            endpoints: effectiveEndpoints
        )
    }

    init(
        entries: [Entry],
        defaultEndpoints: [NRConstants.RelayEndpoint]? = nil,
        preferencesStore: RelayPreferencesStoring? = nil
    ) {
        self.entries = entries
        self.defaultEndpoints = defaultEndpoints ?? entries.map(\.endpoint)
        self.preferencesStore = preferencesStore
        self.relayURL = entries.first?.endpoint.url ?? NRConstants.defaultRelayURL
        self.consecutiveConnectionFailures = Self.sanitizedConnectionFailureCounts(
            from: preferencesStore,
            endpoints: entries.map(\.endpoint)
        )
    }

    deinit {
        readTasks.forEach { $0.cancel() }
    }

    func connect() async throws {
        let enabledEntries = entries.filter { $0.endpoint.readEnabled || $0.endpoint.writeEnabled }
        var results: [URL: RelayConnectionCheckResult] = [:]
        for entry in entries where !(entry.endpoint.readEnabled || entry.endpoint.writeEnabled) {
            consecutiveConnectionFailures.removeValue(forKey: entry.endpoint.url)
            results[entry.endpoint.url] = RelayConnectionCheckResult(
                url: entry.endpoint.url,
                state: .skippedOff,
                readEnabled: entry.endpoint.readEnabled,
                writeEnabled: entry.endpoint.writeEnabled
            )
        }
        guard !enabledEntries.isEmpty else {
            connectionCheckResults = results
            persistConnectionFailureCounts()
            throw RelayPoolError.noEnabledRelays
        }

        var reasons: [String] = []
        var successCount = 0

        for entry in enabledEntries {
            do {
                try await entry.client.connect()
                successCount += 1
                consecutiveConnectionFailures.removeValue(forKey: entry.endpoint.url)
                results[entry.endpoint.url] = RelayConnectionCheckResult(
                    url: entry.endpoint.url,
                    state: .connected,
                    readEnabled: entry.endpoint.readEnabled,
                    writeEnabled: entry.endpoint.writeEnabled
                )
            } catch {
                let reason = error.localizedDescription
                reasons.append("\(entry.endpoint.url.host() ?? entry.endpoint.url.absoluteString): \(reason)")
                let failureCount = (consecutiveConnectionFailures[entry.endpoint.url] ?? 0) + 1
                consecutiveConnectionFailures[entry.endpoint.url] = failureCount
                results[entry.endpoint.url] = RelayConnectionCheckResult(
                    url: entry.endpoint.url,
                    state: .failed(reason),
                    readEnabled: entry.endpoint.readEnabled,
                    writeEnabled: entry.endpoint.writeEnabled,
                    consecutiveFailures: failureCount
                )
            }
        }
        connectionCheckResults = results
        persistConnectionFailureCounts()
        if successCount == 0, !enabledEntries.isEmpty {
            throw RelayPoolError.connectFailed(reasons)
        }
        attachReadStreams()
    }

    func authenticate(with keyStore: KeyStore) async throws {
        var authSucceeded = false
        for entry in entries where entry.endpoint.readEnabled || entry.endpoint.writeEnabled {
            do {
                try await entry.client.authenticate(with: keyStore)
                if entry.endpoint.requiresNIP42Auth {
                    authSucceeded = true
                }
            } catch {
                if entry.endpoint.requiresNIP42Auth {
                    throw error
                }
            }
        }
        isAuthenticated = authSucceeded || entries.allSatisfy { !$0.endpoint.requiresNIP42Auth }
    }

    func publish(_ event: NostrEvent) async throws {
        let writable = entries.filter { $0.endpoint.writeEnabled }
        guard !writable.isEmpty else { throw RelayPoolError.noWritableRelays }

        var reasons: [String] = []
        var successCount = 0
        for entry in writable {
            do {
                try await entry.client.publish(event)
                successCount += 1
            } catch {
                reasons.append("\(entry.endpoint.url.host() ?? entry.endpoint.url.absoluteString): \(error.localizedDescription)")
            }
        }
        if successCount == 0 {
            throw RelayPoolError.publishFailed(reasons)
        }
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        let readable = entries.filter { $0.endpoint.readEnabled }
        guard !readable.isEmpty else { throw RelayPoolError.noReadableRelays }

        var reasons: [String] = []
        var successCount = 0
        for entry in readable {
            do {
                try await entry.client.subscribe(subscription)
                successCount += 1
            } catch {
                reasons.append("\(entry.endpoint.url.host() ?? entry.endpoint.url.absoluteString): \(error.localizedDescription)")
            }
        }
        if successCount == 0 {
            throw RelayPoolError.subscribeFailed(reasons)
        }
    }

    @discardableResult
    func setRelayState(for url: URL, readEnabled: Bool, writeEnabled: Bool) -> Bool {
        var didChange = false
        var resetEntries: [Entry] = []
        for index in entries.indices where entries[index].endpoint.url == url {
            let existing = entries[index]
            guard existing.endpoint.readEnabled != readEnabled || existing.endpoint.writeEnabled != writeEnabled else {
                continue
            }
            resetEntries.append(existing)
            entries[index].endpoint = NRConstants.RelayEndpoint(
                url: entries[index].endpoint.url,
                readEnabled: readEnabled,
                writeEnabled: writeEnabled,
                requiresNIP42Auth: entries[index].endpoint.requiresNIP42Auth
            )
            didChange = true
        }
        guard didChange else { return false }
        resetRelayRuntimeForSettingsChange(resetEntries)
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        preferencesStore?.save(entries.map { $0.endpoint })
        clearPersistedConnectionFailureCounts()
        attachReadStreams()
        return true
    }

    func addRelay(
        url: URL,
        readEnabled: Bool = true,
        writeEnabled: Bool = true,
        requiresNIP42Auth: Bool = false
    ) throws {
        guard !entries.contains(where: { $0.endpoint.url == url }) else {
            throw RelayEndpointInputError.duplicate
        }
        let endpoint = NRConstants.RelayEndpoint(
            url: url,
            readEnabled: readEnabled,
            writeEnabled: writeEnabled,
            requiresNIP42Auth: requiresNIP42Auth
        )
        resetRelayRuntimeForSettingsChange(entries)
        entries.append(Self.makeEntry(endpoint: endpoint))
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        preferencesStore?.save(entries.map { $0.endpoint })
        clearPersistedConnectionFailureCounts()
        attachReadStreams()
    }

    func removeRelay(url: URL) throws {
        guard !RelayEndpointInput.isBuiltInRelay(url) else {
            throw RelayEndpointInputError.cannotRemoveBuiltIn
        }
        guard let index = entries.firstIndex(where: { $0.endpoint.url == url }) else {
            throw RelayEndpointInputError.notFound
        }
        resetRelayRuntimeForSettingsChange([entries[index]])
        entries.remove(at: index)
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        preferencesStore?.save(entries.map { $0.endpoint })
        clearPersistedConnectionFailureCounts()
        attachReadStreams()
    }

    func restoreDefaultRelays() {
        resetRelayRuntimeForSettingsChange(entries)
        entries = defaultEndpoints.map(Self.makeEntry(endpoint:))
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        preferencesStore?.save(entries.map { $0.endpoint })
        clearPersistedConnectionFailureCounts()
        attachReadStreams()
    }

    func currentRelayEndpoints() -> [NRConstants.RelayEndpoint] {
        entries.map { $0.endpoint }
    }

    func relayAvailabilitySummary() -> RelayAvailabilitySummary {
        RelayAvailabilitySummary(endpoints: currentRelayEndpoints())
    }

    func relayConnectionCheckResults() -> [RelayConnectionCheckResult] {
        entries.compactMap { connectionCheckResults[$0.endpoint.url] }
    }

    func clearRelayConnectionCheckResults() {
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        clearPersistedConnectionFailureCounts()
    }

    func resetRelayRuntimeForKeyChange() {
        isAuthenticated = false
        readTasks.forEach { $0.cancel() }
        readTasks = []
        seenEventIDs.removeAll()
        connectionCheckResults.removeAll()
        consecutiveConnectionFailures.removeAll()
        clearPersistedConnectionFailureCounts()
        entries.forEach { entry in
            (entry.client as? RelayRuntimeResetting)?.resetRelayRuntimeForKeyChange()
        }
    }

    private func resetRelayRuntimeForSettingsChange(_ resetEntries: [Entry]) {
        guard !resetEntries.isEmpty else { return }
        isAuthenticated = false
        readTasks.forEach { $0.cancel() }
        readTasks = []
        seenEventIDs.removeAll()
        resetEntries.forEach { entry in
            (entry.client as? RelayRuntimeResetting)?.resetRelayRuntimeForKeyChange()
        }
    }

    private static func makeEntry(endpoint: NRConstants.RelayEndpoint) -> Entry {
        Entry(
            endpoint: endpoint,
            client: WebSocketRelayClient(relayURL: endpoint.url, requiresAuth: endpoint.requiresNIP42Auth)
        )
    }

    private static func sanitizedConnectionFailureCounts(
        from preferencesStore: RelayPreferencesStoring?,
        endpoints: [NRConstants.RelayEndpoint]
    ) -> [URL: Int] {
        guard let store = preferencesStore as? RelayConnectionFailureCountStoring else {
            return [:]
        }
        let configuredURLs = Set(endpoints.map(\.url))
        let loadedCounts = store.loadConnectionFailureCounts()
        let sanitizedCounts = loadedCounts.reduce(into: [URL: Int]()) { counts, entry in
            guard configuredURLs.contains(entry.key), entry.value > 0 else { return }
            counts[entry.key] = entry.value
        }
        if sanitizedCounts != loadedCounts {
            store.saveConnectionFailureCounts(sanitizedCounts)
        }
        return sanitizedCounts
    }

    private func persistConnectionFailureCounts() {
        (preferencesStore as? RelayConnectionFailureCountStoring)?
            .saveConnectionFailureCounts(consecutiveConnectionFailures)
    }

    private func clearPersistedConnectionFailureCounts() {
        (preferencesStore as? RelayConnectionFailureCountStoring)?
            .clearConnectionFailureCounts()
    }

    private func attachReadStreams() {
        readTasks.forEach { $0.cancel() }
        readTasks = []
        for entry in entries where entry.endpoint.readEnabled {
            let task = Task { [weak self] in
                guard let self else { return }
                for await event in entry.client.incomingEvents {
                    if self.markSeen(event.id) {
                        self.continuation?.yield(event)
                    }
                }
            }
            readTasks.append(task)
        }
    }

    private func markSeen(_ eventID: String) -> Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        if seenEventIDs.contains(eventID) {
            return false
        }
        if seenEventIDs.count >= maxSeenIDs, let first = seenEventIDs.first {
            seenEventIDs.remove(first)
        }
        seenEventIDs.insert(eventID)
        return true
    }
}
