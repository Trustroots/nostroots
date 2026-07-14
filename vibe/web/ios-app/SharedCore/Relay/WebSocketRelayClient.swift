import Foundation

enum RelayClientError: Error, LocalizedError {
    case invalidRelayURL
    case socketNotConnected
    case authChallengeTimeout
    case malformedRelayMessage
    case publishRejected(String)
    case subscriptionClosed(String)
    case publishAckTimeout

    var errorDescription: String? {
        switch self {
        case .invalidRelayURL: return "Relay URL must use ws:// or wss://."
        case .socketNotConnected: return "Relay socket is not connected."
        case .authChallengeTimeout: return "Relay auth challenge was not received in time."
        case .malformedRelayMessage: return "Received malformed relay message."
        case .publishRejected(let reason): return "Relay rejected event: \(reason)"
        case .subscriptionClosed(let reason): return "Relay closed subscription: \(reason)"
        case .publishAckTimeout: return "Relay did not acknowledge the event in time."
        }
    }
}

final class WebSocketRelayClient: RelayClient, RelayRuntimeResetting {
    let relayURL: URL
    private(set) var isAuthenticated = false
    private let requiresAuth: Bool

    private var task: URLSessionWebSocketTask?
    private var readLoopTask: Task<Void, Never>?
    private var pingTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var continuation: AsyncStream<NostrEvent>.Continuation?
    private var subscriptionsByID: [String: RelaySubscription] = [:]
    private var desiredSubscriptions = Set<RelaySubscription>()
    private var authWaiters: [CheckedContinuation<String, Error>] = []
    private var pendingEventACK: [String: CheckedContinuation<Void, Error>] = [:]
    private var authKeyStore: KeyStore?
    private var reconnectAttempt = 0
    private var shouldReconnect = true
    private var isConnecting = false
    private let stateLock = NSLock()
    private let ackTimeoutSeconds: TimeInterval

    @inline(__always)
    private func withStateLock<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    lazy var incomingEvents: AsyncStream<NostrEvent> = AsyncStream { continuation in
        self.continuation = continuation
    }

    init(
        relayURL: URL = NRConstants.defaultRelayURL,
        requiresAuth: Bool = true,
        ackTimeoutSeconds: TimeInterval = 10
    ) {
        self.relayURL = relayURL
        self.requiresAuth = requiresAuth
        self.ackTimeoutSeconds = ackTimeoutSeconds
    }

    deinit {
        withStateLock {
            shouldReconnect = false
        }
        readLoopTask?.cancel()
        pingTask?.cancel()
        reconnectTask?.cancel()
        task?.cancel(with: .normalClosure, reason: nil)
    }

    func connect() async throws {
        guard relayURL.scheme == "ws" || relayURL.scheme == "wss" else {
            throw RelayClientError.invalidRelayURL
        }
        let shouldShortCircuit: Bool = withStateLock {
            let alreadyConnected = socketIsConnected(task)
            if alreadyConnected || isConnecting {
                return true
            }
            shouldReconnect = true
            isConnecting = true
            return false
        }
        if shouldShortCircuit {
            return
        }

        do {
            try await establishSocket()
            withStateLock {
                if !requiresAuth {
                    isAuthenticated = true
                }
            }
            let storedKeyStore = withStateLock { authKeyStore }
            if requiresAuth, let storedKeyStore {
                try await authenticate(with: storedKeyStore)
                try await replaySubscriptions()
            }
            withStateLock {
                isConnecting = false
                reconnectAttempt = 0
            }
        } catch {
            withStateLock {
                isConnecting = false
            }
            throw error
        }
    }

    func authenticate(with keyStore: KeyStore) async throws {
        if !requiresAuth {
            withStateLock {
                isAuthenticated = true
            }
            return
        }
        withStateLock {
            authKeyStore = keyStore
        }

        guard let socket = task else { throw RelayClientError.socketNotConnected }
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw KeyStoreError.missingSecret }

        let probeSub = "auth-\(UUID().uuidString.prefix(8))"
        let filter: [String: Any] = ["authors": [pubkey], "limit": 1]
        try await send(array: ["REQ", probeSub, filter], over: socket)

        let challenge = try await waitForChallenge(timeoutSeconds: 8)
        let authEvent = try NIP42Auth.makeAuthEvent(challenge: challenge, relayURL: relayURL, keyStore: keyStore)
        try await sendEventForAck(authEvent, command: "AUTH", over: socket)

        withStateLock {
            isAuthenticated = true
        }
    }

    func publish(_ event: NostrEvent) async throws {
        guard let socket = task else { throw RelayClientError.socketNotConnected }
        guard isAuthenticated || !requiresAuth else {
            throw NSError(domain: "RelayClient", code: 401, userInfo: [NSLocalizedDescriptionKey: "Relay auth required"])
        }
        guard !event.isExpired else { return }
        try await sendEventForAck(event, command: "EVENT", over: socket)
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        let socket = withStateLock { () -> URLSessionWebSocketTask? in
            desiredSubscriptions.insert(subscription)
            return task
        }
        guard let socket else { return } // queued until reconnect
        try await sendSubscription(subscription, over: socket)
    }

    func resetRelayRuntimeForKeyChange() {
        let (pendingAcks, waiters, socket) = withStateLock { () -> ([String: CheckedContinuation<Void, Error>], [CheckedContinuation<String, Error>], URLSessionWebSocketTask?) in
            shouldReconnect = false
            isConnecting = false
            isAuthenticated = false
            authKeyStore = nil
            desiredSubscriptions.removeAll()
            subscriptionsByID.removeAll()
            let outstandingAcks = pendingEventACK
            pendingEventACK.removeAll()
            let outstandingWaiters = authWaiters
            authWaiters.removeAll()
            let currentSocket = task
            task = nil
            return (outstandingAcks, outstandingWaiters, currentSocket)
        }
        readLoopTask?.cancel()
        pingTask?.cancel()
        reconnectTask?.cancel()
        readLoopTask = nil
        pingTask = nil
        reconnectTask = nil
        socket?.cancel(with: .normalClosure, reason: nil)
        pendingAcks.values.forEach { $0.resume(throwing: RelayClientError.socketNotConnected) }
        waiters.forEach { $0.resume(throwing: RelayClientError.socketNotConnected) }
    }

    private func sendSubscription(_ subscription: RelaySubscription, over socket: URLSessionWebSocketTask) async throws {
        let subscriptionID = "sub-\(UUID().uuidString.prefix(8))"
        var filter: [String: Any] = ["kinds": [subscription.eventKind]]
        if !subscription.recipientPubkeys.isEmpty {
            filter["#p"] = subscription.recipientPubkeys
        }
        withStateLock {
            subscriptionsByID[subscriptionID] = subscription
        }
        try await send(array: ["REQ", subscriptionID, filter], over: socket)
    }

    private func replaySubscriptions() async throws {
        guard let socket = task else { return }
        let saved = withStateLock { () -> [RelaySubscription] in
            let subscriptions = Array(desiredSubscriptions)
            subscriptionsByID.removeAll()
            return subscriptions
        }
        for subscription in saved {
            try await sendSubscription(subscription, over: socket)
        }
    }

    private func startReadLoop() {
        readLoopTask?.cancel()
        guard let socket = task else { return }
        readLoopTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                do {
                    let message = try await socket.receive()
                    try self.handle(message: message)
                } catch {
                    await self.handleTransportFailure(error)
                    break
                }
            }
        }
    }

    private func startPingLoop() {
        pingTask?.cancel()
        guard let socket = task else { return }
        pingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                if Task.isCancelled { break }
                do {
                    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                        socket.sendPing { error in
                            if let error {
                                continuation.resume(throwing: error)
                            } else {
                                continuation.resume()
                            }
                        }
                    }
                } catch {
                    await self.handleTransportFailure(error)
                    break
                }
            }
        }
    }

    private func waitForChallenge(timeoutSeconds: TimeInterval) async throws -> String {
        try await withThrowingTaskGroup(of: String.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
                    self.withStateLock {
                        self.authWaiters.append(continuation)
                    }
                }
            }
            group.addTask {
                try await Task.sleep(for: .seconds(timeoutSeconds))
                throw RelayClientError.authChallengeTimeout
            }
            guard let challenge = try await group.next() else {
                throw RelayClientError.authChallengeTimeout
            }
            group.cancelAll()
            return challenge
        }
    }

    private func send(array: [Any], over socket: URLSessionWebSocketTask) async throws {
        let payload = try JSONSerialization.data(withJSONObject: array, options: [])
        guard let text = String(data: payload, encoding: .utf8) else {
            throw RelayClientError.malformedRelayMessage
        }
        try await socket.send(.string(text))
    }

    private func sendEventForAck(_ event: NostrEvent, command: String, over socket: URLSessionWebSocketTask) async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    self.withStateLock {
                        self.pendingEventACK[event.id] = continuation
                    }

                    Task {
                        do {
                            try await self.send(array: [command, NostrWireCodec.eventDictionary(from: event)], over: socket)
                        } catch {
                            let pending = self.withStateLock {
                                self.pendingEventACK.removeValue(forKey: event.id)
                            }
                            pending?.resume(throwing: error)
                        }
                    }
                }
            }
            group.addTask {
                try await Task.sleep(for: .seconds(self.ackTimeoutSeconds))
                let pending = self.withStateLock {
                    self.pendingEventACK.removeValue(forKey: event.id)
                }
                pending?.resume(throwing: RelayClientError.publishAckTimeout)
                throw RelayClientError.publishAckTimeout
            }
            _ = try await group.next()
            group.cancelAll()
        }
    }

    private func handle(message: URLSessionWebSocketTask.Message) throws {
        let text: String
        switch message {
        case .string(let value):
            text = value
        case .data(let data):
            guard let decoded = String(data: data, encoding: .utf8) else { return }
            text = decoded
        @unknown default:
            return
        }

        guard let data = text.data(using: .utf8),
              let frame = try JSONSerialization.jsonObject(with: data) as? [Any],
              let type = frame.first as? String else {
            throw RelayClientError.malformedRelayMessage
        }

        switch type {
        case "AUTH":
            guard frame.count >= 2, let challenge = frame[1] as? String else { return }
            let (waiters, cachedKeyStore) = withStateLock { () -> ([CheckedContinuation<String, Error>], KeyStore?) in
                let cachedWaiters = authWaiters
                authWaiters.removeAll()
                return (cachedWaiters, authKeyStore)
            }
            if !waiters.isEmpty {
                waiters.forEach { $0.resume(returning: challenge) }
            } else if let cachedKeyStore {
                Task { [weak self] in
                    guard let self else { return }
                    try? await self.respondToChallenge(challenge, keyStore: cachedKeyStore)
                }
            }
        case "OK":
            guard frame.count >= 4, let eventID = frame[1] as? String, let accepted = frame[2] as? Bool else { return }
            let messageText = frame[3] as? String ?? "unknown relay error"
            let ack = withStateLock {
                pendingEventACK.removeValue(forKey: eventID)
            }
            if accepted {
                ack?.resume()
            } else {
                ack?.resume(throwing: RelayClientError.publishRejected(messageText))
            }
        case "CLOSED":
            guard frame.count >= 3, let subID = frame[1] as? String else { return }
            let messageText = frame[2] as? String ?? "subscription closed"
            let cachedKeyStore = withStateLock { () -> KeyStore? in
                subscriptionsByID.removeValue(forKey: subID)
                return authKeyStore
            }
            if requiresAuth, messageText.hasPrefix("auth-required:"), let cachedKeyStore {
                Task { [weak self] in
                    guard let self else { return }
                    do {
                        try await self.authenticate(with: cachedKeyStore)
                        try await self.replaySubscriptions()
                    } catch {
                        await self.handleTransportFailure(error)
                    }
                }
            } else if messageText.hasPrefix("restricted:") {
                throw RelayClientError.subscriptionClosed(messageText)
            }
        case "EVENT":
            guard frame.count >= 3 else { return }
            let subID = frame[1] as? String
            guard let event = NostrWireCodec.event(from: frame[2]) else { return }
            if let subID {
                let subscription = withStateLock { subscriptionsByID[subID] }
                if let subscription, !matches(event: event, subscription: subscription) {
                    return
                }
            }
            continuation?.yield(event)
        default:
            break
        }
    }

    private func respondToChallenge(_ challenge: String, keyStore: KeyStore) async throws {
        guard let socket = task else { throw RelayClientError.socketNotConnected }
        let authEvent = try NIP42Auth.makeAuthEvent(challenge: challenge, relayURL: relayURL, keyStore: keyStore)
        try await sendEventForAck(authEvent, command: "AUTH", over: socket)
        withStateLock {
            isAuthenticated = true
        }
    }

    private func matches(event: NostrEvent, subscription: RelaySubscription) -> Bool {
        guard event.kind == subscription.eventKind else { return false }
        guard !subscription.recipientPubkeys.isEmpty else { return true }
        let recipients = Set(event.recipients)
        return !recipients.isDisjoint(with: subscription.recipientPubkeys)
    }

    private func socketIsConnected(_ socket: URLSessionWebSocketTask?) -> Bool {
        guard let socket else { return false }
        return socket.closeCode == .invalid
    }

    private func establishSocket() async throws {
        let socket = URLSession.shared.webSocketTask(with: relayURL)
        socket.resume()
        withStateLock {
            task = socket
        }
        startReadLoop()
        startPingLoop()
    }

    @MainActor
    private func handleTransportFailure(_ error: Error) async {
        transitionToDisconnected()
        scheduleReconnect()
        _ = error
    }

    private func transitionToDisconnected() {
        let (pendingAcks, waiters) = withStateLock { () -> ([String: CheckedContinuation<Void, Error>], [CheckedContinuation<String, Error>]) in
            task = nil
            isAuthenticated = false
            isConnecting = false
            subscriptionsByID.removeAll()
            let outstandingAcks = pendingEventACK
            pendingEventACK.removeAll()
            let outstandingWaiters = authWaiters
            authWaiters.removeAll()
            return (outstandingAcks, outstandingWaiters)
        }

        pendingAcks.values.forEach { $0.resume(throwing: RelayClientError.socketNotConnected) }
        waiters.forEach { $0.resume(throwing: RelayClientError.socketNotConnected) }
    }

    private func scheduleReconnect() {
        let didSchedule = withStateLock { () -> Bool in
            guard shouldReconnect, reconnectTask == nil else {
                return false
            }
            reconnectTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let (keepTrying, attempt) = self.withStateLock { () -> (Bool, Int) in
                    let currentAttempt = self.reconnectAttempt
                    self.reconnectAttempt += 1
                    return (self.shouldReconnect, currentAttempt)
                }
                guard keepTrying else { break }
                let delaySeconds = min(30, max(1, Int(pow(2.0, Double(attempt)))))
                try? await Task.sleep(for: .seconds(delaySeconds))
                if Task.isCancelled { break }
                do {
                    try await self.connect()
                    self.withStateLock {
                        self.reconnectTask = nil
                    }
                    return
                } catch {
                    continue
                }
            }
            self.withStateLock {
                self.reconnectTask = nil
            }
        }
            return true
        }
        if !didSchedule {
            return
        }
    }
}
