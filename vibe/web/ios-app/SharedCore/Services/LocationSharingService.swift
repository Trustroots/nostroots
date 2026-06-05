import Combine
import Foundation

enum LocationSharingServiceError: Error, LocalizedError {
    case missingRecipient
    case noActiveSession
    case keyChangeWhileSharing
    case recipientResolutionFailed(input: String, underlying: Error)

    var errorDescription: String? {
        switch self {
        case .missingRecipient:
            return "Add at least one recipient."
        case .noActiveSession:
            return "Start a sharing session first."
        case .keyChangeWhileSharing:
            return "Stop sharing before clearing or changing keys so recipients can be told the session ended."
        case .recipientResolutionFailed(let input, let underlying):
            let baseMessage = "Could not resolve \"\(input)\". Check the Trustroots username, profile link, NIP-05 address, npub, or public key."
            let detail = underlying.localizedDescription
            if detail == RecipientInputError.invalidFormat.localizedDescription ||
                detail == RecipientInputError.empty.localizedDescription {
                return baseMessage
            }
            return "\(baseMessage) \(detail)"
        }
    }
}

struct InvitePublishResult: Equatable {
    let sentCount: Int
    let failedLookupInputs: [String]
    let failedSendInputs: [String]

    init(sentCount: Int, failedInputs: [String]) {
        self.sentCount = sentCount
        self.failedLookupInputs = failedInputs
        self.failedSendInputs = []
    }

    init(sentCount: Int, failedLookupInputs: [String] = [], failedSendInputs: [String] = []) {
        self.sentCount = sentCount
        self.failedLookupInputs = failedLookupInputs
        self.failedSendInputs = failedSendInputs
    }

    var failedInputs: [String] {
        failedLookupInputs + failedSendInputs
    }

    var hasFailures: Bool {
        !failedInputs.isEmpty
    }

    static func == (lhs: InvitePublishResult, rhs: InvitePublishResult) -> Bool {
        lhs.sentCount == rhs.sentCount && lhs.failedInputs == rhs.failedInputs
    }
}

struct SharePublishResult: Equatable {
    let sentCount: Int
    let failedLookupInputs: [String]
    let failedSendInputs: [String]

    init(sentCount: Int, failedInputs: [String]) {
        self.sentCount = sentCount
        self.failedLookupInputs = failedInputs
        self.failedSendInputs = []
    }

    init(sentCount: Int, failedLookupInputs: [String] = [], failedSendInputs: [String] = []) {
        self.sentCount = sentCount
        self.failedLookupInputs = failedLookupInputs
        self.failedSendInputs = failedSendInputs
    }

    var failedInputs: [String] {
        failedLookupInputs + failedSendInputs
    }

    var hasFailures: Bool {
        !failedInputs.isEmpty
    }

    static func == (lhs: SharePublishResult, rhs: SharePublishResult) -> Bool {
        lhs.sentCount == rhs.sentCount && lhs.failedInputs == rhs.failedInputs
    }
}

private struct RecipientResolutionBatch {
    let resolved: [ResolvedRecipient]
    let failures: [String]

    var resolvedPubkeys: [String] {
        resolved.map(\.pubkey)
    }
}

private struct ResolvedRecipient {
    let input: String
    let pubkey: String
}

private struct FanoutPublishReport {
    let sentRecipients: [String]
    let failedRecipients: [String]
    let firstError: Error?
}

struct ActiveSharingSessionRecord: Codable, Equatable {
    let sessionID: String
    let expiresAtUnix: Int
    let recipients: [String]
    let stopRecipients: [String]
    let recipientDisplayValues: [String]?
    let latestLatitude: Double
    let latestLongitude: Double

    init(
        sessionID: String,
        expiresAtUnix: Int,
        recipients: [String],
        stopRecipients: [String],
        recipientDisplayValues: [String]? = nil,
        latestLatitude: Double,
        latestLongitude: Double
    ) {
        self.sessionID = sessionID
        self.expiresAtUnix = expiresAtUnix
        self.recipients = recipients
        self.stopRecipients = stopRecipients
        self.recipientDisplayValues = recipientDisplayValues
        self.latestLatitude = latestLatitude
        self.latestLongitude = latestLongitude
    }
}

protocol ActiveSharingSessionStoring {
    func load() -> ActiveSharingSessionRecord?
    func save(_ record: ActiveSharingSessionRecord)
    func clear()
}

final class UserDefaultsActiveSharingSessionStore: ActiveSharingSessionStoring {
    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = "nr.ios.activeSharingSession.v1") {
        self.defaults = defaults
        self.key = key
    }

    func load() -> ActiveSharingSessionRecord? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ActiveSharingSessionRecord.self, from: data)
    }

    func save(_ record: ActiveSharingSessionRecord) {
        if let data = try? JSONEncoder().encode(record) {
            defaults.set(data, forKey: key)
        }
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }
}

private extension Array where Element == ResolvedRecipient {
    var resolvedPubkeys: [String] {
        map(\.pubkey)
    }
}

@MainActor
final class LocationSharingService: ObservableObject {
    private enum RelayCheckHistoryDefaultsKey {
        static let summary = "swiftroots.lastRelayCheckSummary"
        static let checkedAtUnix = "swiftroots.lastRelayCheckUnix"
    }

    @Published private(set) var isAuthenticated = false
    @Published private(set) var isSharing = false
    @Published private(set) var sessionID: String?
    @Published private(set) var sessionExpiresAtUnix: Int?
    @Published private(set) var statusText = "Import key to begin."
    @Published private(set) var receivedLocations: [StoredLocationRecord] = []
    @Published private(set) var hasImportedKey = false
    @Published private(set) var publicKeyHex: String?
    @Published private(set) var keyStorageStatus = KeyStorageStatus(hasSecret: false, usesSimulatorFallback: false)
    @Published private(set) var lastRelayCheckSummary = ""
    @Published private(set) var lastRelayCheckDate: Date?
    @Published private(set) var isAutomaticPublishingPaused = false

    private let keyStore: KeyStore
    private let relay: RelayClient
    private let storage: AppStorage
    private let nip44: NIP44Boxing
    private let nip05Resolver: Nip05Resolving
    private let relayCheckHistoryDefaults: UserDefaults
    private let activeSessionStore: ActiveSharingSessionStoring
    private let publishInterval: TimeInterval
    private var publishTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var expirationPruneTask: Task<Void, Never>?
    private var sessionRecipients: [String] = []
    private var sessionStopRecipients: [String] = []
    private var sessionRecipientDisplayValues: [String] = []
    private var latestLatLon: (Double, Double)?

    var activeSessionRecipientDisplayValues: [String] {
        sessionRecipientDisplayValues.isEmpty ? sessionRecipients : sessionRecipientDisplayValues
    }

    init(
        keyStore: KeyStore = KeychainKeyStore(),
        relay: RelayClient = RelayPoolClient(),
        storage: AppStorage = UserDefaultsAppStorage(),
        nip44: NIP44Boxing = NIP44Box(),
        nip05Resolver: Nip05Resolving = Nip05Resolver(),
        relayCheckHistoryDefaults: UserDefaults = .standard,
        activeSessionStore: ActiveSharingSessionStoring = UserDefaultsActiveSharingSessionStore(),
        publishInterval: TimeInterval = NRConstants.defaultPublishInterval
    ) {
        self.keyStore = keyStore
        self.relay = relay
        self.storage = storage
        self.nip44 = nip44
        self.nip05Resolver = nip05Resolver
        self.relayCheckHistoryDefaults = relayCheckHistoryDefaults
        self.activeSessionStore = activeSessionStore
        self.publishInterval = publishInterval
        loadRelayCheckHistory()
        restoreActiveSessionState()
        refreshKeyState()
    }

    @discardableResult
    func importKey(_ raw: String) throws -> KeyImportResult {
        try ensureKeyCanChange()
        let result = try KeyImportParser.parse(raw)
        try keyStore.importSecret(result.secretHex)
        resetRuntimeForKeyChange()
        refreshKeyState()
        statusText = "Key imported."
        return result
    }

    func generateNewKey() throws -> String {
        try ensureKeyCanChange()
        let secretHex = try NIP19.generateSecretHex()
        try keyStore.importSecret(secretHex)
        resetRuntimeForKeyChange()
        refreshKeyState()
        statusText = "New key generated."
        return try NIP19.encodeNsec(secretHex: secretHex)
    }

    func currentNsec() throws -> String {
        guard let secretHex = keyStore.currentSecretHex() else { throw KeyStoreError.missingSecret }
        return try NIP19.encodeNsec(secretHex: secretHex)
    }

    var relayAvailabilityText: String {
        if let pool = relay as? RelayPoolClient {
            return pool.relayAvailabilitySummary().userFacingDescription
        }
        return "Relay will connect automatically when needed."
    }

    var relayEndpoints: [NRConstants.RelayEndpoint] {
        guard let pool = relay as? RelayPoolClient else {
            return []
        }
        return pool.currentRelayEndpoints()
    }

    var relayConnectionCheckResults: [RelayConnectionCheckResult] {
        guard let pool = relay as? RelayPoolClient else {
            return []
        }
        return pool.relayConnectionCheckResults()
    }

    @discardableResult
    func setRelayState(for url: URL, readEnabled: Bool, writeEnabled: Bool) -> Bool {
        guard let pool = relay as? RelayPoolClient else { return false }
        guard pool.setRelayState(for: url, readEnabled: readEnabled, writeEnabled: writeEnabled) else {
            return false
        }
        markRelayReadinessStale()
        clearRelayCheckHistory()
        statusText = relayAvailabilityText
        return true
    }

    @discardableResult
    func addRelay(urlString: String) throws -> URL {
        guard let pool = relay as? RelayPoolClient else {
            throw RelayEndpointInputError.relaySettingsUnavailable
        }
        let url = try RelayEndpointInput.normalizedURL(from: urlString)
        try pool.addRelay(url: url)
        markRelayReadinessStale()
        clearRelayCheckHistory()
        statusText = relayAvailabilityText
        return url
    }

    func removeRelay(url: URL) throws {
        guard let pool = relay as? RelayPoolClient else {
            throw RelayEndpointInputError.relaySettingsUnavailable
        }
        try pool.removeRelay(url: url)
        markRelayReadinessStale()
        clearRelayCheckHistory()
        statusText = relayAvailabilityText
    }

    func restoreDefaultRelays() throws {
        guard let pool = relay as? RelayPoolClient else {
            throw RelayEndpointInputError.relaySettingsUnavailable
        }
        pool.restoreDefaultRelays()
        markRelayReadinessStale()
        clearRelayCheckHistory()
        statusText = relayAvailabilityText
    }

    func clearKey() throws {
        try ensureKeyCanChange()
        try keyStore.clearSecret()
        resetRuntimeForKeyChange()
        refreshKeyState()
        statusText = "Key cleared. \(keyStorageStatus.userFacingDescription)"
    }

    private func ensureKeyCanChange() throws {
        guard !isSharing else {
            throw LocationSharingServiceError.keyChangeWhileSharing
        }
    }

    private func markRelayReadinessStale() {
        isAuthenticated = false
    }

    private func markRelayReadinessStaleAfterSendFailure() {
        markRelayReadinessStale()
        clearRelayCheckHistory()
    }

    private func pauseAutomaticPublishingAfterSendFailure() {
        markRelayReadinessStaleAfterSendFailure()
        guard isSharing else { return }
        publishTask?.cancel()
        publishTask = nil
        isAutomaticPublishingPaused = true
    }

    func authenticate() async throws {
        let previousServiceStatusText = statusText
        receiveTask?.cancel()
        receiveTask = nil
        expirationPruneTask?.cancel()
        expirationPruneTask = nil
        markRelayReadinessStale()
        do {
            try await relay.connect()
            try await relay.authenticate(with: keyStore)
            isAuthenticated = relay.isAuthenticated
            guard let me = keyStore.currentPublicKeyHex() else { return }
            try await relay.subscribe(.init(eventKind: NRConstants.nostrailLocationEventKind, recipientPubkeys: [me]))
            startReceiverLoop()
            startExpirationPruneLoop()
            statusText = "Connected to \(relay.relayURL.host() ?? relay.relayURL.absoluteString)."
            recordRelayCheckHistory(
                SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                    results: relayConnectionCheckResults,
                    fallback: "Relays ready.",
                    previousServiceStatusText: previousServiceStatusText
                )
            )
            if isSharing {
                startPeriodicPublishLoop()
            }
        } catch {
            receiveTask?.cancel()
            receiveTask = nil
            expirationPruneTask?.cancel()
            expirationPruneTask = nil
            markRelayReadinessStale()
            let message = RelayUserFacingMessageFormatter.message(for: error, context: .connect)
            statusText = message
            recordRelayCheckHistory(
                SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                    results: relayConnectionCheckResults,
                    fallback: message,
                    previousServiceStatusText: previousServiceStatusText
                )
            )
            throw error
        }
    }

    func startSession(
        recipients: [String],
        initialLatitude: Double,
        initialLongitude: Double,
        duration: TimeInterval = NRConstants.defaultSessionDuration
    ) async throws {
        try await ensureRelayReady()
        let resolvedRecipients = try await resolveRecipientInputs(recipients)
        guard !resolvedRecipients.isEmpty else {
            throw LocationSharingServiceError.missingRecipient
        }
        try await startSession(
            resolvedRecipients: resolvedRecipients,
            initialLatitude: initialLatitude,
            initialLongitude: initialLongitude,
            duration: duration
        )
    }

    func startSessionReportingFailures(
        recipients: [String],
        initialLatitude: Double,
        initialLongitude: Double,
        duration: TimeInterval = NRConstants.defaultSessionDuration
    ) async throws -> SharePublishResult {
        try await ensureRelayReady()
        let batch = await resolveRecipientInputsAllowingFailures(recipients)
        guard !batch.resolved.isEmpty else {
            if let firstFailure = batch.failures.first {
                throw LocationSharingServiceError.recipientResolutionFailed(
                    input: firstFailure,
                    underlying: RecipientInputError.invalidFormat
                )
            }
            throw LocationSharingServiceError.missingRecipient
        }
        return try await startSessionReportingPublishFailures(
            resolvedRecipients: batch.resolved,
            resolutionFailures: batch.failures,
            initialLatitude: initialLatitude,
            initialLongitude: initialLongitude,
            duration: duration
        )
    }

    private func startSession(
        resolvedRecipients: [String],
        initialLatitude: Double,
        initialLongitude: Double,
        duration: TimeInterval
    ) async throws {
        let sessionEnd = Int(Date().timeIntervalSince1970) + Int(duration)
        sessionID = UUID().uuidString
        sessionExpiresAtUnix = sessionEnd
        sessionRecipients = resolvedRecipients
        sessionStopRecipients = resolvedRecipients
        sessionRecipientDisplayValues = resolvedRecipients
        latestLatLon = (initialLatitude, initialLongitude)
        isSharing = true

        do {
            try await publishLocation(lat: initialLatitude, lon: initialLongitude, expiresAtUnix: sessionEnd)
        } catch {
            clearActiveSession()
            pauseAutomaticPublishingAfterSendFailure()
            statusText = RelayUserFacingMessageFormatter.message(for: error, context: .publish)
            throw error
        }
        statusText = "Sharing started."
        persistActiveSessionState()
        startPeriodicPublishLoop()
    }

    private func startSessionReportingPublishFailures(
        resolvedRecipients: [ResolvedRecipient],
        resolutionFailures: [String],
        initialLatitude: Double,
        initialLongitude: Double,
        duration: TimeInterval
    ) async throws -> SharePublishResult {
        let sessionEnd = Int(Date().timeIntervalSince1970) + Int(duration)
        sessionID = UUID().uuidString
        sessionExpiresAtUnix = sessionEnd
        sessionRecipients = resolvedRecipients.resolvedPubkeys
        sessionStopRecipients = resolvedRecipients.resolvedPubkeys
        sessionRecipientDisplayValues = resolvedRecipients.map(\.input)
        latestLatLon = (initialLatitude, initialLongitude)
        isSharing = true

        let events = try makeLocationEvents(lat: initialLatitude, lon: initialLongitude, expiresAtUnix: sessionEnd)
        let report = await publishFanoutReportingFailures(events)
        guard !report.sentRecipients.isEmpty else {
            clearActiveSession()
            pauseAutomaticPublishingAfterSendFailure()
            let failedSendInputs = failedInputs(
                for: report.failedRecipients,
                from: resolvedRecipients,
                fallbackToAll: true
            )
            statusText = publishStatusText(
                successText: "Sharing started.",
                lookupFailures: resolutionFailures,
                sendFailures: failedSendInputs,
                firstSendError: report.firstError,
                didSendAny: false
            )
            return SharePublishResult(sentCount: 0, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
        }

        sessionRecipients = report.sentRecipients
        sessionStopRecipients = report.sentRecipients
        sessionRecipientDisplayValues = displayValues(for: report.sentRecipients, from: resolvedRecipients)
        let failedSendInputs = failedInputs(for: report.failedRecipients, from: resolvedRecipients)
        statusText = publishStatusText(
            successText: "Sharing started.",
            lookupFailures: resolutionFailures,
            sendFailures: failedSendInputs,
            firstSendError: report.firstError,
            didSendAny: true
        )
        persistActiveSessionState()
        startPeriodicPublishLoop()
        return SharePublishResult(sentCount: report.sentRecipients.count, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
    }

    private func startPeriodicPublishLoop() {
        publishTask?.cancel()
        isAutomaticPublishingPaused = false
        publishTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                guard self.isSharing, let sessionEnd = self.sessionExpiresAtUnix else { break }
                let remaining = sessionEnd - Int(Date().timeIntervalSince1970)
                guard remaining > 0 else {
                    self.publishTask = nil
                    self.expireCurrentSession()
                    break
                }
                try? await Task.sleep(for: .seconds(min(self.publishInterval, TimeInterval(remaining))))
                guard !Task.isCancelled, self.isSharing, let latest = self.latestLatLon, let sessionEnd = self.sessionExpiresAtUnix else { continue }
                guard Int(Date().timeIntervalSince1970) < sessionEnd else {
                    self.publishTask = nil
                    self.expireCurrentSession()
                    break
                }
                do {
                    try await self.ensureRelayReady()
                    try await self.publishLocation(lat: latest.0, lon: latest.1, expiresAtUnix: sessionEnd)
                } catch {
                    self.pauseAutomaticPublishingAfterSendFailure()
                    self.statusText = RelayUserFacingMessageFormatter.message(for: error, context: .publish)
                    break
                }
            }
        }
    }

    func updateCurrentLocation(latitude: Double, longitude: Double) {
        latestLatLon = (latitude, longitude)
        persistActiveSessionState()
    }

    func updateSharedLocation(latitude: Double, longitude: Double) async throws {
        latestLatLon = (latitude, longitude)
        let sessionEnd = try activeSessionEndOrThrow()
        try await ensureRelayReady()
        do {
            try await publishLocation(lat: latitude, lon: longitude, expiresAtUnix: sessionEnd)
        } catch {
            pauseAutomaticPublishingAfterSendFailure()
            statusText = RelayUserFacingMessageFormatter.message(for: error, context: .publish)
            throw error
        }
        statusText = "Location updated."
        persistActiveSessionState()
        startPeriodicPublishLoop()
    }

    func updateSharedLocation(recipients: [String], latitude: Double, longitude: Double) async throws {
        latestLatLon = (latitude, longitude)
        _ = try activeSessionEndOrThrow()
        let resolvedRecipients = try await resolveRecipientInputs(recipients)
        guard !resolvedRecipients.isEmpty else {
            throw LocationSharingServiceError.missingRecipient
        }
        try await updateSharedLocation(resolvedRecipients: resolvedRecipients, latitude: latitude, longitude: longitude)
    }

    func updateSharedLocationReportingFailures(recipients: [String], latitude: Double, longitude: Double) async throws -> SharePublishResult {
        latestLatLon = (latitude, longitude)
        _ = try activeSessionEndOrThrow()
        let batch = await resolveRecipientInputsAllowingFailures(recipients)
        guard !batch.resolved.isEmpty else {
            if let firstFailure = batch.failures.first {
                throw LocationSharingServiceError.recipientResolutionFailed(
                    input: firstFailure,
                    underlying: RecipientInputError.invalidFormat
                )
            }
            throw LocationSharingServiceError.missingRecipient
        }
        return try await updateSharedLocationReportingPublishFailures(
            resolvedRecipients: batch.resolved,
            resolutionFailures: batch.failures,
            latitude: latitude,
            longitude: longitude
        )
    }

    private func updateSharedLocation(resolvedRecipients: [String], latitude: Double, longitude: Double) async throws {
        let previousRecipients = sessionRecipients
        let previousStopRecipients = sessionStopRecipients
        let previousDisplayValues = sessionRecipientDisplayValues
        sessionRecipients = resolvedRecipients
        sessionRecipientDisplayValues = resolvedRecipients
        sessionStopRecipients = dedupedRecipients(sessionStopRecipients + resolvedRecipients, fallback: resolvedRecipients[0])
        do {
            try await updateSharedLocation(latitude: latitude, longitude: longitude)
        } catch {
            sessionRecipients = previousRecipients
            sessionStopRecipients = previousStopRecipients
            sessionRecipientDisplayValues = previousDisplayValues
            throw error
        }
        sessionRecipients = dedupedValues(previousRecipients + resolvedRecipients)
        sessionStopRecipients = dedupedRecipients(previousStopRecipients + resolvedRecipients, fallback: resolvedRecipients[0])
        sessionRecipientDisplayValues = dedupedValues(previousDisplayValues + resolvedRecipients)
        persistActiveSessionState()
    }

    private func updateSharedLocationReportingPublishFailures(
        resolvedRecipients: [ResolvedRecipient],
        resolutionFailures: [String],
        latitude: Double,
        longitude: Double
    ) async throws -> SharePublishResult {
        latestLatLon = (latitude, longitude)
        let sessionEnd = try activeSessionEndOrThrow()
        try await ensureRelayReady()

        let previousRecipients = sessionRecipients
        let previousStopRecipients = sessionStopRecipients
        let previousDisplayValues = sessionRecipientDisplayValues
        sessionRecipients = resolvedRecipients.resolvedPubkeys
        sessionRecipientDisplayValues = resolvedRecipients.map(\.input)
        sessionStopRecipients = dedupedRecipients(sessionStopRecipients + resolvedRecipients.resolvedPubkeys, fallback: resolvedRecipients.resolvedPubkeys[0])

        let events = try makeLocationEvents(lat: latitude, lon: longitude, expiresAtUnix: sessionEnd)
        let report = await publishFanoutReportingFailures(events)
        guard !report.sentRecipients.isEmpty else {
            sessionRecipients = previousRecipients
            sessionStopRecipients = previousStopRecipients
            sessionRecipientDisplayValues = previousDisplayValues
            pauseAutomaticPublishingAfterSendFailure()
            let failedSendInputs = failedInputs(
                for: report.failedRecipients,
                from: resolvedRecipients,
                fallbackToAll: true
            )
            statusText = publishStatusText(
                successText: "Location updated.",
                lookupFailures: resolutionFailures,
                sendFailures: failedSendInputs,
                firstSendError: report.firstError,
                didSendAny: false
            )
            return SharePublishResult(sentCount: 0, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
        }

        sessionRecipients = dedupedValues(previousRecipients + report.sentRecipients)
        sessionStopRecipients = dedupedRecipients(previousStopRecipients + report.sentRecipients, fallback: report.sentRecipients[0])
        sessionRecipientDisplayValues = dedupedValues(
            previousDisplayValues + displayValues(for: report.sentRecipients, from: resolvedRecipients)
        )
        let failedSendInputs = failedInputs(for: report.failedRecipients, from: resolvedRecipients)
        statusText = publishStatusText(
            successText: "Location updated.",
            lookupFailures: resolutionFailures,
            sendFailures: failedSendInputs,
            firstSendError: report.firstError,
            didSendAny: true
        )
        persistActiveSessionState()
        startPeriodicPublishLoop()
        return SharePublishResult(sentCount: report.sentRecipients.count, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
    }

    func pruneExpiredLocations(nowUnix: Int = Int(Date().timeIntervalSince1970)) {
        storage.removeExpired(nowUnix: nowUnix)
        receivedLocations = storage.allLocationRecords()
    }

    private func activeSessionEndOrThrow() throws -> Int {
        guard isSharing, let sessionEnd = sessionExpiresAtUnix else {
            statusText = LocationSharingServiceError.noActiveSession.localizedDescription
            throw LocationSharingServiceError.noActiveSession
        }
        guard Int(Date().timeIntervalSince1970) < sessionEnd else {
            expireCurrentSession()
            throw LocationSharingServiceError.noActiveSession
        }
        return sessionEnd
    }

    private func resetRuntimeForKeyChange() {
        publishTask?.cancel()
        publishTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        expirationPruneTask?.cancel()
        expirationPruneTask = nil
        markRelayReadinessStale()
        isAutomaticPublishingPaused = false
        isSharing = false
        sessionID = nil
        sessionExpiresAtUnix = nil
        sessionRecipients = []
        sessionStopRecipients = []
        sessionRecipientDisplayValues = []
        latestLatLon = nil
        activeSessionStore.clear()
        (relay as? RelayRuntimeResetting)?.resetRelayRuntimeForKeyChange()
        clearRelayCheckHistory()
        storage.removeAll()
        receivedLocations = []
    }

    private func loadRelayCheckHistory() {
        lastRelayCheckSummary = normalizedRelayCheckSummary(
            relayCheckHistoryDefaults.string(forKey: RelayCheckHistoryDefaultsKey.summary)
        )
        let timestamp = relayCheckHistoryDefaults.double(forKey: RelayCheckHistoryDefaultsKey.checkedAtUnix)
        lastRelayCheckDate = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    private func recordRelayCheckHistory(_ summary: String, checkedAt: Date = Date()) {
        let cleanSummary = normalizedRelayCheckSummary(summary)
        guard !cleanSummary.isEmpty else {
            clearRelayCheckHistory()
            return
        }
        lastRelayCheckSummary = cleanSummary
        lastRelayCheckDate = checkedAt
        relayCheckHistoryDefaults.set(cleanSummary, forKey: RelayCheckHistoryDefaultsKey.summary)
        relayCheckHistoryDefaults.set(checkedAt.timeIntervalSince1970, forKey: RelayCheckHistoryDefaultsKey.checkedAtUnix)
    }

    private func clearRelayCheckHistory() {
        lastRelayCheckSummary = ""
        lastRelayCheckDate = nil
        relayCheckHistoryDefaults.removeObject(forKey: RelayCheckHistoryDefaultsKey.summary)
        relayCheckHistoryDefaults.removeObject(forKey: RelayCheckHistoryDefaultsKey.checkedAtUnix)
    }

    private func normalizedRelayCheckSummary(_ summary: String?) -> String {
        summary?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    func stopSession() async throws {
        guard isSharing, let sessionID, let sessionEnd = sessionExpiresAtUnix else {
            statusText = LocationSharingServiceError.noActiveSession.localizedDescription
            throw LocationSharingServiceError.noActiveSession
        }
        let now = Int(Date().timeIntervalSince1970)
        guard now < sessionEnd else {
            expireCurrentSession()
            throw LocationSharingServiceError.noActiveSession
        }
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw KeyStoreError.missingSecret }
        publishTask?.cancel()
        publishTask = nil
        try await ensureRelayReady()

        let payload = StopEventPayload(sessionId: sessionID, createdAt: now)
        let encoded = try NostrailPayloadCodec.encode(.stop(payload))
        let stopRecipients = sessionStopRecipients.isEmpty ? sessionRecipients : sessionStopRecipients
        let events = try encryptAndSignFanout(
            plainContent: encoded,
            kind: NRConstants.nostrailLocationEventKind,
            recipients: stopRecipients,
            pubkey: pubkey,
            expirationUnix: now + 300
        )
        do {
            for event in events {
                try await relay.publish(event)
            }
        } catch {
            pauseAutomaticPublishingAfterSendFailure()
            statusText = RelayUserFacingMessageFormatter.message(for: error, context: .stop)
            throw error
        }
        clearActiveSession()
        statusText = "Sharing stopped."
    }

    func publishInvite(to recipientPubkey: String, message: String) async throws {
        try await ensureRelayReady()
        let resolvedRecipients = try await resolveRecipientInputs([recipientPubkey])
        guard !resolvedRecipients.isEmpty else {
            throw LocationSharingServiceError.missingRecipient
        }
        try await publishInvite(toResolvedRecipients: resolvedRecipients, message: message)
    }

    func publishInvite(to recipients: [String], message: String) async throws {
        try await ensureRelayReady()
        let resolvedRecipients = try await resolveRecipientInputs(recipients)
        guard !resolvedRecipients.isEmpty else {
            throw LocationSharingServiceError.missingRecipient
        }
        try await publishInvite(toResolvedRecipients: resolvedRecipients, message: message)
    }

    func publishInviteReportingFailures(to recipients: [String], message: String) async throws -> InvitePublishResult {
        try await ensureRelayReady()
        let batch = await resolveRecipientInputsAllowingFailures(recipients)
        guard !batch.resolved.isEmpty else {
            if let firstFailure = batch.failures.first {
                throw LocationSharingServiceError.recipientResolutionFailed(
                    input: firstFailure,
                    underlying: RecipientInputError.invalidFormat
                )
            }
            throw LocationSharingServiceError.missingRecipient
        }
        return try await publishInviteReportingPublishFailures(
            toResolvedRecipients: batch.resolved,
            resolutionFailures: batch.failures,
            message: message
        )
    }

    private func publishInvite(toResolvedRecipients recipients: [String], message: String) async throws {
        let now = Int(Date().timeIntervalSince1970)
        let payload = InviteEventPayload(message: message, createdAt: now)
        let encoded = try NostrailPayloadCodec.encode(.invite(payload))
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw KeyStoreError.missingSecret }
        let events = try encryptAndSignFanout(
            plainContent: encoded,
            kind: NRConstants.nostrailLocationEventKind,
            recipients: recipients,
            pubkey: pubkey,
            expirationUnix: now + 86_400
        )
        do {
            for event in events {
                try await relay.publish(event)
            }
        } catch {
            pauseAutomaticPublishingAfterSendFailure()
            statusText = RelayUserFacingMessageFormatter.message(for: error, context: .publish)
            throw error
        }
    }

    private func publishInviteReportingPublishFailures(
        toResolvedRecipients recipients: [ResolvedRecipient],
        resolutionFailures: [String],
        message: String
    ) async throws -> InvitePublishResult {
        let now = Int(Date().timeIntervalSince1970)
        let payload = InviteEventPayload(message: message, createdAt: now)
        let encoded = try NostrailPayloadCodec.encode(.invite(payload))
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw KeyStoreError.missingSecret }
        let events = try encryptAndSignFanout(
            plainContent: encoded,
            kind: NRConstants.nostrailLocationEventKind,
            recipients: recipients.resolvedPubkeys,
            pubkey: pubkey,
            expirationUnix: now + 86_400
        )
        let report = await publishFanoutReportingFailures(events)
        guard !report.sentRecipients.isEmpty else {
            pauseAutomaticPublishingAfterSendFailure()
            let failedSendInputs = failedInputs(
                for: report.failedRecipients,
                from: recipients,
                fallbackToAll: true
            )
            statusText = publishStatusText(
                successText: "Invite sent.",
                lookupFailures: resolutionFailures,
                sendFailures: failedSendInputs,
                firstSendError: report.firstError,
                didSendAny: false
            )
            return InvitePublishResult(sentCount: 0, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
        }

        let failedSendInputs = failedInputs(for: report.failedRecipients, from: recipients)
        statusText = publishStatusText(
            successText: "Invite sent.",
            lookupFailures: resolutionFailures,
            sendFailures: failedSendInputs,
            firstSendError: report.firstError,
            didSendAny: true
        )
        return InvitePublishResult(sentCount: report.sentRecipients.count, failedLookupInputs: resolutionFailures, failedSendInputs: failedSendInputs)
    }

    private func ensureRelayReady() async throws {
        guard keyStore.currentPublicKeyHex() != nil else { throw KeyStoreError.missingSecret }
        if !isAuthenticated {
            try await authenticate()
        }
    }

    private func resolveRecipientInputs(_ inputs: [String]) async throws -> [String] {
        let uniqueInputs = uniqueRecipientInputs(inputs)

        var resolved: [String] = []
        for trimmed in uniqueInputs {
            do {
                resolved.append(try await resolveRecipientInput(trimmed))
            } catch {
                throw LocationSharingServiceError.recipientResolutionFailed(input: trimmed, underlying: error)
            }
        }
        return dedupedValues(resolved)
    }

    private func resolveRecipientInputsAllowingFailures(_ inputs: [String]) async -> RecipientResolutionBatch {
        let uniqueInputs = uniqueRecipientInputs(inputs)
        var resolved: [ResolvedRecipient] = []
        var failures: [String] = []
        var seenPubkeys = Set<String>()
        for trimmed in uniqueInputs {
            do {
                let pubkey = try await resolveRecipientInput(trimmed)
                guard seenPubkeys.insert(pubkey).inserted else { continue }
                resolved.append(ResolvedRecipient(input: trimmed, pubkey: pubkey))
            } catch {
                failures.append(trimmed)
            }
        }
        return RecipientResolutionBatch(resolved: resolved, failures: failures)
    }

    private func uniqueRecipientInputs(_ inputs: [String]) -> [String] {
        var uniqueInputs: [String] = []
        var seenInputKeys = Set<String>()
        for input in inputs {
            let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            let duplicateKey = (try? RecipientInputNormalizer.normalize(trimmed).duplicateKey) ?? "raw:\(trimmed.lowercased())"
            guard seenInputKeys.insert(duplicateKey).inserted else { continue }
            uniqueInputs.append(trimmed)
        }
        return uniqueInputs
    }

    private func resolveRecipientInput(_ input: String) async throws -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let pubkey = try? NIP19.importPubkey(trimmed) {
            return pubkey
        }
        let handle = trimmed.hasPrefix("@") || !trimmed.contains("@") ? try TrustrootsUsername.nip05(trimmed) : trimmed
        return try await nip05Resolver.resolve(handle)
    }

    private func publishLocation(lat: Double, lon: Double, expiresAtUnix: Int) async throws {
        let events = try makeLocationEvents(lat: lat, lon: lon, expiresAtUnix: expiresAtUnix)
        for event in events {
            try await relay.publish(event)
        }
    }

    private func makeLocationEvents(lat: Double, lon: Double, expiresAtUnix: Int) throws -> [NostrEvent] {
        let snapped = LocationSnapper.snap(latitude: lat, longitude: lon)
        let now = Int(Date().timeIntervalSince1970)
        let payload = LocationEventPayload(
            sessionId: sessionID ?? UUID().uuidString,
            area: snapped.areaCode,
            centerLat: snapped.latitude,
            centerLon: snapped.longitude,
            accuracyM: snapped.accuracyMeters,
            createdAt: now,
            expiresAt: expiresAtUnix
        )
        let plain = try NostrailPayloadCodec.encode(.location(payload))
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw KeyStoreError.missingSecret }
        return try encryptAndSignFanout(
            plainContent: plain,
            kind: NRConstants.nostrailLocationEventKind,
            recipients: sessionRecipients,
            pubkey: pubkey,
            expirationUnix: expiresAtUnix
        )
    }

    private func publishFanoutReportingFailures(_ events: [NostrEvent]) async -> FanoutPublishReport {
        var sentRecipients: [String] = []
        var failedRecipients: [String] = []
        var firstError: Error?

        for event in events {
            let recipient = event.recipients.first ?? ""
            do {
                try await relay.publish(event)
                if !recipient.isEmpty {
                    sentRecipients.append(recipient)
                }
            } catch {
                if firstError == nil {
                    firstError = error
                }
                if !recipient.isEmpty {
                    failedRecipients.append(recipient)
                }
            }
        }

        if !failedRecipients.isEmpty {
            markRelayReadinessStaleAfterSendFailure()
        }
        return FanoutPublishReport(
            sentRecipients: dedupedValues(sentRecipients),
            failedRecipients: dedupedValues(failedRecipients),
            firstError: firstError
        )
    }

    private func failedInputs(
        for failedPubkeys: [String],
        from resolvedRecipients: [ResolvedRecipient],
        fallbackToAll: Bool = false
    ) -> [String] {
        var inputByPubkey: [String: String] = [:]
        for recipient in resolvedRecipients where inputByPubkey[recipient.pubkey] == nil {
            inputByPubkey[recipient.pubkey] = recipient.input
        }
        let inputs = failedPubkeys.map { inputByPubkey[$0] ?? $0 }
        guard inputs.isEmpty, fallbackToAll else { return inputs }
        return resolvedRecipients.map(\.input)
    }

    private func displayValues(for sentPubkeys: [String], from resolvedRecipients: [ResolvedRecipient]) -> [String] {
        var inputByPubkey: [String: String] = [:]
        for recipient in resolvedRecipients where inputByPubkey[recipient.pubkey] == nil {
            inputByPubkey[recipient.pubkey] = recipient.input
        }
        return sentPubkeys.map { inputByPubkey[$0] ?? $0 }
    }

    private func publishStatusText(
        successText: String,
        lookupFailures: [String],
        sendFailures: [String],
        firstSendError: Error?,
        didSendAny: Bool
    ) -> String {
        if lookupFailures.isEmpty, sendFailures.isEmpty {
            return successText
        }
        if didSendAny {
            let notice = NostrailRecipientFeedbackFormatter.failureSummaryText(
                lookupInputs: lookupFailures,
                sendInputs: sendFailures
            )
            guard !notice.isEmpty else { return successText }
            return "\(successText) \(notice)"
        }
        if !sendFailures.isEmpty {
            return firstSendError.map { RelayUserFacingMessageFormatter.message(for: $0, context: .publish) }
                ?? RelayUserFacingMessageFormatter.message(for: RelayPoolError.publishFailed([]), context: .publish)
        }
        return "Check recipients and try again."
    }

    private func expireCurrentSession() {
        publishTask?.cancel()
        publishTask = nil
        clearActiveSession()
        statusText = NostrailActionErrorFormatter.expiredSessionMessage
    }

    private func clearActiveSession() {
        isSharing = false
        isAutomaticPublishingPaused = false
        sessionID = nil
        sessionExpiresAtUnix = nil
        sessionRecipients = []
        sessionStopRecipients = []
        sessionRecipientDisplayValues = []
        latestLatLon = nil
        activeSessionStore.clear()
    }

    private func restoreActiveSessionState(nowUnix: Int = Int(Date().timeIntervalSince1970)) {
        guard keyStore.currentSecretHex() != nil else {
            activeSessionStore.clear()
            return
        }
        guard let record = activeSessionStore.load() else { return }
        guard record.expiresAtUnix > nowUnix else {
            activeSessionStore.clear()
            statusText = NostrailActionErrorFormatter.expiredSessionMessage
            return
        }
        sessionID = record.sessionID
        sessionExpiresAtUnix = record.expiresAtUnix
        sessionRecipients = record.recipients
        sessionStopRecipients = record.stopRecipients
        sessionRecipientDisplayValues = record.recipientDisplayValues ?? record.recipients
        latestLatLon = (record.latestLatitude, record.latestLongitude)
        isSharing = true
        isAutomaticPublishingPaused = true
        markRelayReadinessStale()
        clearRelayCheckHistory()
        statusText = "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
    }

    private func persistActiveSessionState() {
        guard isSharing,
              let sessionID,
              let sessionExpiresAtUnix,
              let latestLatLon else {
            return
        }
        activeSessionStore.save(
            ActiveSharingSessionRecord(
                sessionID: sessionID,
                expiresAtUnix: sessionExpiresAtUnix,
                recipients: sessionRecipients,
                stopRecipients: sessionStopRecipients,
                recipientDisplayValues: activeSessionRecipientDisplayValues,
                latestLatitude: latestLatLon.0,
                latestLongitude: latestLatLon.1
            )
        )
    }

    private func encryptAndSignFanout(
        plainContent: String,
        kind: Int,
        recipients: [String],
        pubkey: String,
        expirationUnix: Int
    ) throws -> [NostrEvent] {
        guard let secret = keyStore.currentSecretHex() else { throw KeyStoreError.missingSecret }
        let uniqueRecipients = dedupedRecipients(recipients, fallback: pubkey)
        return try uniqueRecipients.map { recipient in
            let cipher = try nip44.encrypt(plainText: plainContent, localSecretHex: secret, peerPubkeyHex: recipient)
            let tags: [NostrTag] = [
                ["expiration", "\(expirationUnix)"],
                ["p", recipient]
            ]
            let unsigned = NostrEventFactory.makeUnsigned(pubkey: pubkey, kind: kind, tags: tags, content: cipher)
            return try keyStore.sign(unsigned: unsigned)
        }
    }

    private func dedupedRecipients(_ recipients: [String], fallback: String) -> [String] {
        let base = recipients.isEmpty ? [fallback] : recipients
        return dedupedValues(base)
    }

    private func dedupedValues(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for value in values where seen.insert(value).inserted {
            result.append(value)
        }
        return result
    }

    private func refreshKeyState() {
        publicKeyHex = keyStore.currentPublicKeyHex()
        hasImportedKey = publicKeyHex != nil
        keyStorageStatus = keyStore.storageStatus()
    }

    private func startReceiverLoop() {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            guard let self else { return }
            for await event in relay.incomingEvents {
                await self.consume(event)
            }
            guard !Task.isCancelled else { return }
            self.handleReceiverLoopEnded()
        }
    }

    private func handleReceiverLoopEnded() {
        receiveTask = nil
        markRelayReadinessStale()
        statusText = RelayUserFacingMessageFormatter.message(for: RelayClientError.subscriptionClosed("stream ended"), context: .subscribe)
    }

    private func startExpirationPruneLoop() {
        expirationPruneTask?.cancel()
        expirationPruneTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                guard !Task.isCancelled else { break }
                self.pruneExpiredLocations()
            }
        }
    }

    private func consume(_ event: NostrEvent) async {
        guard !event.isExpired else { return }
        guard let secret = keyStore.currentSecretHex() else { return }
        guard let plain = try? nip44.decrypt(cipherText: event.content, localSecretHex: secret, peerPubkeyHex: event.pubkey) else {
            return
        }
        guard let payload = NostrailPayloadCodec.decode(plain) else { return }
        switch payload {
        case .location(let location):
            let record = StoredLocationRecord(
                id: event.id,
                fromPubkey: event.pubkey,
                location: location,
                receivedAt: Int(Date().timeIntervalSince1970)
            )
            storage.save(record: record)
            pruneExpiredLocations()
        case .invite:
            statusText = "Invite received."
        case .stop(let stop):
            storage.removeLocationRecords(sessionId: stop.sessionId, fromPubkey: event.pubkey)
            pruneExpiredLocations()
            statusText = "A peer stopped sharing."
        }
    }
}
