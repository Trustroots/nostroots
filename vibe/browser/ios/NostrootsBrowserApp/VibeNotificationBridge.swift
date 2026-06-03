import Foundation

struct VibeNotificationBridgeResponse {
    let id: String
    let ok: Bool
    let result: Any?
    let error: String?

    func jsonObject() -> [String: Any] {
        var object: [String: Any] = [
            "source": "nostroots-notifications-bridge",
            "id": id,
            "ok": ok
        ]
        if let result {
            object["result"] = result
        }
        if let error {
            object["error"] = error
        }
        return object
    }
}

@MainActor
final class VibeNotificationBridge {
    static let knownMethods = Set([
        "getState",
        "enable",
        "disable",
        "subscribePlusCode",
        "unsubscribePlusCode",
        "sendTestNotification"
    ])

    private let manager: VibePushNotificationManager

    init(manager: VibePushNotificationManager) {
        self.manager = manager
    }

    func handle(_ raw: Any) async -> VibeNotificationBridgeResponse {
        guard
            let message = raw as? [String: Any],
            message["source"] as? String == "nostroots-notifications-bridge",
            let id = message["id"] as? String,
            let method = message["method"] as? String,
            Self.knownMethods.contains(method)
        else {
            return .failure(id: "unknown", error: "Invalid native notification bridge message.")
        }

        do {
            let result = try await handle(method: method, params: message["params"])
            return .success(id: id, result: result)
        } catch {
            return .failure(id: id, error: error.localizedDescription)
        }
    }

    private func handle(method: String, params: Any?) async throws -> Any {
        switch method {
        case "getState":
            return manager.statusObject()
        case "enable":
            return try await manager.enable()
        case "disable":
            return try await manager.disable()
        case "subscribePlusCode":
            return try await manager.subscribe(plusCode: plusCodeParam(params))
        case "unsubscribePlusCode":
            return try await manager.unsubscribe(plusCode: plusCodeParam(params))
        case "sendTestNotification":
            return try await manager.sendTestNotification()
        default:
            throw VibePushError.publishFailed("Unknown native notification method.")
        }
    }

    private func plusCodeParam(_ params: Any?) throws -> String {
        guard let rawParams = params as? [Any],
              rawParams.count == 1,
              let plusCode = rawParams[0] as? String,
              !plusCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw VibePushError.publishFailed("Missing plus code.")
        }
        return plusCode
    }
}

extension VibeNotificationBridgeResponse {
    static func success(id: String, result: Any?) -> VibeNotificationBridgeResponse {
        VibeNotificationBridgeResponse(id: id, ok: true, result: result, error: nil)
    }

    static func failure(id: String, error: String) -> VibeNotificationBridgeResponse {
        VibeNotificationBridgeResponse(id: id, ok: false, result: nil, error: error)
    }
}
