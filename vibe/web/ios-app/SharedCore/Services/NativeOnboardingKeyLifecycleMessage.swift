import Foundation

enum NativeOnboardingKeyRetryAction {
    case generateKey
    case importKey
    case saveGeneratedKey
    case clearKey

    var retryInstruction: String {
        switch self {
        case .generateKey:
            return "Try Generate Key again."
        case .importKey:
            return "Try Import Key again."
        case .saveGeneratedKey:
            return "Try Save Key again."
        case .clearKey:
            return "Try Clear Key again before continuing."
        }
    }
}

enum NativeOnboardingKeyLifecycleMessage {
    static func generatedKeySaved(storageStatus: KeyStorageStatus) -> String {
        "Generated key saved. \(storageStatus.userFacingDescription)"
    }

    static func clearKeySuccess(storageStatus: KeyStorageStatus) -> String {
        "Key cleared. \(storageStatus.userFacingDescription) Set up the key you want to use."
    }

    static func generatedKeyFailure(error _: Error) -> String {
        "We could not generate a key on this device. \(NativeOnboardingKeyRetryAction.generateKey.retryInstruction)"
    }

    static func keyStorageFailure(
        error: Error,
        fallbackMessage: String,
        retryAction: NativeOnboardingKeyRetryAction
    ) -> String {
        guard error is KeychainKeyStoreError else {
            return fallbackMessage
        }
        return "\(fallbackMessage) \(retryAction.retryInstruction)"
    }

    static func keySaveFailure(
        error: Error,
        fallbackMessage: String,
        retryAction: NativeOnboardingKeyRetryAction,
        requiresTrustrootsLink: Bool
    ) -> String {
        let message = keyStorageFailure(
            error: error,
            fallbackMessage: fallbackMessage,
            retryAction: retryAction
        )
        guard requiresTrustrootsLink, error is KeychainKeyStoreError else {
            return message
        }
        return "\(message) Your local Trustroots link stays as-is."
    }

    static func clearKeyFailure(error: Error, requiresTrustrootsLink: Bool) -> String {
        let message = keyStorageFailure(
            error: error,
            fallbackMessage: error.localizedDescription,
            retryAction: .clearKey
        )
        guard error is KeychainKeyStoreError else { return message }
        if requiresTrustrootsLink {
            return "\(message) Your key and local Trustroots link remain as-is until Clear Key succeeds."
        }
        return "\(message) Your key remains as-is until Clear Key succeeds."
    }

    static func stopSharingFailure(
        userFacingMessage: String,
        requiresTrustrootsLink: Bool,
        isSharingStillActive: Bool
    ) -> String {
        guard isSharingStillActive else { return userFacingMessage }
        if requiresTrustrootsLink {
            return "\(userFacingMessage) Your sharing session is still active, and your key and local Trustroots link remain as-is. Retry Stop Sharing before changing keys."
        }
        return "\(userFacingMessage) Your sharing session is still active, and your key remains as-is. Retry Stop Sharing before changing keys."
    }

    static func useDifferentKeyConfirmation(requiresTrustrootsLink: Bool) -> String {
        if requiresTrustrootsLink {
            return SwiftrootsKeyLifecycleMessage.clearKeyConfirmation
        }
        return NostrailKeyLifecycleGuard.clearKeyConfirmation
    }
}

enum NativeOnboardingStopSharingFormatter {
    static func buttonTitle(
        isStopping: Bool,
        requiresTrustrootsLink: Bool,
        isSharing: Bool,
        sessionExpiresAtUnix: Int?,
        serviceStatusText: String,
        hasPendingRetry: Bool = false,
        now: Date = Date()
    ) -> String {
        if requiresTrustrootsLink {
            return SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: isStopping,
                isSharing: isSharing,
                sessionExpiresAtUnix: sessionExpiresAtUnix,
                now: now,
                serviceStatusText: serviceStatusText,
                hasPendingRetry: hasPendingRetry
            )
        }
        return NostrailRelayStatusFormatter.stopSharingButtonTitle(
            isStopping: isStopping,
            serviceStatusText: serviceStatusText,
            hasPendingRetry: hasPendingRetry
        )
    }

    static func helperText(
        requiresTrustrootsLink: Bool,
        buttonTitle: String,
        serviceStatusText: String,
        hasPendingRetry: Bool = false
    ) -> String {
        let retryHelper = requiresTrustrootsLink
            ? SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: serviceStatusText,
                hasPendingRetry: hasPendingRetry
            )
            : NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: serviceStatusText,
                hasPendingRetry: hasPendingRetry
            )
        if !retryHelper.isEmpty {
            return retryHelper
        }
        if buttonTitle == "Clear Expired Sharing" {
            return "Clear expired sharing before using a different key."
        }
        return "Stop sharing before using a different key."
    }
}
