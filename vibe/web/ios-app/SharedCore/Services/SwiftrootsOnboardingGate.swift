import Foundation

enum SwiftrootsOnboardingDefaults {
    static func normalized(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func persist(_ value: String, forKey key: String, defaults: UserDefaults = .standard) {
        let normalizedValue = normalized(value)
        if normalizedValue.isEmpty {
            defaults.removeObject(forKey: key)
        } else {
            defaults.set(normalizedValue, forKey: key)
        }
    }
}

enum SwiftrootsOnboardingGate {
    static func isOnboarded(
        hasImportedKey: Bool,
        publicKeyHex: String?,
        trustrootsUsername: String,
        linkedPublicKeyHex: String
    ) -> Bool {
        guard hasImportedKey,
              let publicKeyHex,
              !SwiftrootsOnboardingDefaults.normalized(trustrootsUsername).isEmpty else {
            return false
        }
        return linkedPublicKeyHex == publicKeyHex
    }

    static func shouldClearStoredLink(
        hasImportedKey: Bool,
        publicKeyHex: String?,
        trustrootsUsername: String,
        linkedPublicKeyHex: String
    ) -> Bool {
        let username = SwiftrootsOnboardingDefaults.normalized(trustrootsUsername)
        if !hasImportedKey || publicKeyHex == nil {
            return !username.isEmpty || !linkedPublicKeyHex.isEmpty
        }
        guard !username.isEmpty else {
            return !linkedPublicKeyHex.isEmpty
        }
        return linkedPublicKeyHex != publicKeyHex
    }
}

enum SwiftrootsOnboardingRecoveryMessage {
    static func staleLinkReset(
        hasImportedKey: Bool,
        publicKeyHex: String?,
        trustrootsUsername: String,
        linkedPublicKeyHex: String,
        existingNotice: String = ""
    ) -> String? {
        guard SwiftrootsOnboardingGate.shouldClearStoredLink(
            hasImportedKey: hasImportedKey,
            publicKeyHex: publicKeyHex,
            trustrootsUsername: trustrootsUsername,
            linkedPublicKeyHex: linkedPublicKeyHex
        ) else {
            return nil
        }
        let currentNotice = existingNotice.trimmingCharacters(in: .whitespacesAndNewlines)
        if !currentNotice.isEmpty {
            return currentNotice
        }
        guard hasImportedKey, publicKeyHex != nil else {
            return "Trustroots link reset. Set up a key, then verify your username."
        }
        return "Trustroots link reset. Verify your username for this key."
    }
}

enum SwiftrootsKeyLifecycleMessage {
    static let clearKeyConfirmation = "You will return to setup and your Trustroots link will be removed from this device. Make sure your nsec or recovery phrase is backed up before clearing it."
    static let stopSharingBeforeClear = "Stop sharing before clearing this key so Swiftroots can tell people the session ended."

    static func stopSharingFailure(_ message: String) -> String {
        "\(message) Your key is still on this device. Retry Stop Sharing before clearing it."
    }

    static func stopSharingRecoveryMessage(
        error: Error,
        serviceStatusText: String,
        userFacingMessage: String
    ) -> String {
        if serviceStatusText == NostrailActionErrorFormatter.expiredSessionMessage {
            return "Expired sharing cleared. You can start a new sharing session when ready."
        }
        if case LocationSharingServiceError.noActiveSession = error {
            return "Sharing is already stopped. You can start a new sharing session when ready."
        }
        return "\(userFacingMessage) Your sharing session is still active. Retry Stop Sharing."
    }
}
