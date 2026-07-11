import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let vibePushNotificationTapped = Notification.Name("nostroots.browser.vibePush.notificationTapped")
}

@MainActor
final class VibePushNotificationManager: NSObject, ObservableObject {
    static let shared = VibePushNotificationManager()

    @Published private(set) var state: VibePushStoredState

    private let store: VibePushStateStoring
    private var publisher: VibePushSubscriptionPublisher?

    init(store: VibePushStateStoring = VibePushStateStore()) {
        self.store = store
        self.state = store.load()
        super.init()
    }

    func configure(keyStore: KeyStore, cryptoProvider: NostrCryptoProviding) {
        publisher = VibePushSubscriptionPublisher(keyStore: keyStore, cryptoProvider: cryptoProvider)
        UNUserNotificationCenter.current().delegate = self
    }

    func statusObject() -> [String: Any] {
        [
            "available": true,
            "enabled": state.enabled,
            "hasToken": state.apnsToken != nil,
            "token": state.apnsToken?.token ?? "",
            "environment": state.apnsToken?.environment ?? currentAPNsEnvironment(),
            "topic": VibePushConstants.appTopic,
            "subscribedPlusCodes": state.subscribedPlusCodes,
            "lastPublishedAt": state.lastPublishedAt ?? 0,
            "lastError": state.lastError ?? ""
        ]
    }

    func enable() async throws -> [String: Any] {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else {
            throw VibePushError.publishFailed("Notification permission was not granted.")
        }
        UIApplication.shared.registerForRemoteNotifications()
        mutateState { state in
            state.enabled = true
            state.lastError = nil
        }
        try await publishIfPossible()
        return statusObject()
    }

    func disable() async throws -> [String: Any] {
        mutateState { state in
            state.enabled = false
            state.lastError = nil
        }
        try await publishIfPossible()
        return statusObject()
    }

    func subscribe(plusCode: String) async throws -> [String: Any] {
        let normalized = normalizePlusCode(plusCode)
        guard !normalized.isEmpty else {
            throw VibePushError.publishFailed("Missing plus code.")
        }
        mutateState { state in
            if !state.subscribedPlusCodes.contains(normalized) {
                state.subscribedPlusCodes.append(normalized)
                state.subscribedPlusCodes.sort()
            }
            state.lastError = nil
        }
        try await publishIfPossible()
        return statusObject()
    }

    func unsubscribe(plusCode: String) async throws -> [String: Any] {
        let normalized = normalizePlusCode(plusCode)
        mutateState { state in
            state.subscribedPlusCodes.removeAll { $0 == normalized }
            state.lastError = nil
        }
        try await publishIfPossible()
        return statusObject()
    }

    func sendTestNotification() async throws -> [String: Any] {
        let content = UNMutableNotificationContent()
        content.title = "Nostroots iOS"
        content.body = "Native notifications are connected."
        content.sound = .default
        content.userInfo = [
            "type": "eventJSON",
            "plusCode": state.subscribedPlusCodes.first ?? ""
        ]
        let request = UNNotificationRequest(
            identifier: "vibe-browser-test-\(UUID().uuidString)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        try await UNUserNotificationCenter.current().add(request)
        return statusObject()
    }

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        mutateState { state in
            state.apnsToken = VibeAPNSToken(token: token, environment: currentAPNsEnvironment())
            state.lastError = nil
        }
        Task { try? await publishIfPossible() }
    }

    func didFailToRegisterForRemoteNotifications(error: Error) {
        mutateState { state in
            state.lastError = error.localizedDescription
        }
    }

    private func publishIfPossible() async throws {
        guard let publisher else { return }
        do {
            _ = try await publisher.publish(state: state)
            mutateState { state in
                state.lastPublishedAt = Int(Date().timeIntervalSince1970)
                state.lastError = nil
            }
        } catch {
            mutateState { state in
                state.lastError = error.localizedDescription
            }
            throw error
        }
    }

    private func mutateState(_ update: (inout VibePushStoredState) -> Void) {
        var updated = state
        update(&updated)
        state = updated
        store.save(updated)
    }

    private func normalizePlusCode(_ plusCode: String) -> String {
        plusCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    private func currentAPNsEnvironment() -> String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }
}

extension VibePushNotificationManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        let plusCode = Self.plusCode(from: userInfo)
        await MainActor.run {
            NotificationCenter.default.post(
                name: .vibePushNotificationTapped,
                object: nil,
                userInfo: ["plusCode": plusCode]
            )
        }
    }

    nonisolated private static func plusCode(from userInfo: [AnyHashable: Any]) -> String {
        if let plusCode = userInfo["plusCode"] as? String, !plusCode.isEmpty {
            return plusCode
        }
        guard let eventJSON = userInfo["event"] as? String,
              let data = eventJSON.data(using: .utf8),
              let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tags = event["tags"] as? [[Any]] else {
            return ""
        }
        for tag in tags {
            guard tag.count >= 3,
                  tag[0] as? String == "l",
                  tag[2] as? String == VibePushConstants.openLocationCodeNamespace,
                  let plusCode = tag[1] as? String else {
                continue
            }
            return plusCode
        }
        return ""
    }
}
