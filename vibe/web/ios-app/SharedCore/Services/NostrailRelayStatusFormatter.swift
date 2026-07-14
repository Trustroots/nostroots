import Foundation

enum NostrailRelayStatusFormatter {
    static func shouldShowReconnect(
        isAuthenticated: Bool,
        serviceStatusText: String,
        relayAvailabilityText: String
    ) -> Bool {
        guard !isAuthenticated,
              SwiftrootsConnectionStatusFormatter.canCheckRelays(relayAvailabilityText: relayAvailabilityText) else {
            return false
        }
        return reconnectReason(serviceStatusText: serviceStatusText) != nil
    }

    static func reconnectButtonTitle(isRunning: Bool, retryWaitText: String = "") -> String {
        if isRunning {
            return "Reconnecting..."
        }
        if !retryWaitText.isEmpty {
            return "Try Again Soon"
        }
        return "Reconnect"
    }

    static func recipientSheetReconnectStatus(
        isRunning: Bool,
        relayCheckResults: [RelayConnectionCheckResult] = []
    ) -> String {
        if isRunning {
            return "Reconnecting..."
        }
        let pathGuidance = SwiftrootsConnectionStatusFormatter.relayPathGuidanceText(results: relayCheckResults)
        if !pathGuidance.isEmpty {
            return "Reconnected with limited relay access. \(pathGuidance)"
        }
        return "Reconnected. Retry rows marked Retry."
    }

    static func reconnectSuccessText(
        previousServiceStatusText: String,
        relayCheckResults: [RelayConnectionCheckResult] = [],
        canShareCurrentArea: Bool = false
    ) -> String {
        let pathGuidance = SwiftrootsConnectionStatusFormatter.relayPathGuidanceText(results: relayCheckResults)
        let reason = reconnectReason(serviceStatusText: previousServiceStatusText)
        if !pathGuidance.isEmpty {
            if case .restoredSession = reason {
                if SwiftrootsConnectionStatusFormatter.isSharingPathUnavailable(results: relayCheckResults) {
                    return "Reconnected with limited relay access. \(pathGuidance) Open Relay Settings before using Share Current Area."
                }
                if canShareCurrentArea {
                    return "Reconnected with limited relay access. \(pathGuidance) Use Share Current Area to send now."
                }
                return "Reconnected with limited relay access. \(pathGuidance) Automatic updates can resume."
            }
            return "Reconnected with limited relay access. \(pathGuidance)"
        }
        switch reason {
        case .stoppedListening:
            return "Reconnected. New shared locations can arrive again."
        case .sendFailed:
            return "Reconnected. Retry any pending invite or location update."
        case .stopFailed:
            return "Reconnected. Retry Stop Sharing."
        case .restoredSession:
            if canShareCurrentArea {
                return "Reconnected. Automatic updates resumed. Use Share Current Area to send now."
            }
            return "Reconnected. Automatic location updates can resume."
        case .connectFailed:
            return "Reconnected. You can receive and send shared locations."
        case nil:
            return "Reconnected."
        }
    }

    static func reconnectFailureText(previousServiceStatusText: String, errorMessage: String) -> String {
        if reconnectReason(serviceStatusText: previousServiceStatusText) == .restoredSession {
            return "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now."
        }
        return errorMessage
    }

    static func recipientSheetRetryHelperText(didReconnect: Bool) -> String {
        didReconnect ? "Retry the rows marked Retry." : "Reconnect before retrying rows marked Retry."
    }

    static let recipientSheetBlockedRetryText = "Sharing has no reachable relay. Open Relay Settings or reconnect before retrying rows marked Retry."

    static func didRelaySettingsRecoverSharingPath(relayAvailabilityText: String) -> Bool {
        relayAvailabilityText != "No relays are configured." &&
            relayAvailabilityText != "All relays are turned off." &&
            !relayAvailabilityText.hasPrefix("Sharing is off")
    }

    static func recipientSheetRelaySettingsStatusText(relayAvailabilityText: String) -> String {
        didRelaySettingsRecoverSharingPath(relayAvailabilityText: relayAvailabilityText)
            ? "Relay settings updated. Retry rows marked Retry."
            : "Sharing is still off. Turn on Share for at least one relay before retrying rows marked Retry."
    }

    static func recipientSheetRelaySettingsChangedStatusText(relayAvailabilityText: String) -> String {
        didRelaySettingsRecoverSharingPath(relayAvailabilityText: relayAvailabilityText)
            ? "Relay settings updated. Check relays before retrying rows marked Retry."
            : "Sharing is still off. Turn on Share for at least one relay before retrying rows marked Retry."
    }

    static func recipientSheetRelayCheckStatusText(
        relayAvailabilityText: String,
        relayCheckResults: [RelayConnectionCheckResult]
    ) -> String {
        guard didRelaySettingsRecoverSharingPath(relayAvailabilityText: relayAvailabilityText) else {
            return "Sharing is still off. Turn on Share for at least one relay before retrying rows marked Retry."
        }
        if SwiftrootsConnectionStatusFormatter.isSharingPathUnavailable(results: relayCheckResults) {
            return "Sharing still has no reachable relay. Check Share toggles or try another relay before retrying rows marked Retry."
        }
        return "Relay settings checked. Retry rows marked Retry."
    }

    static func isSharingBlockedByRelaySettings(relayAvailabilityText: String) -> Bool {
        relayAvailabilityText == "No relays are configured." ||
            relayAvailabilityText == "All relays are turned off." ||
            relayAvailabilityText.hasPrefix("Sharing is off")
    }

    static func mapRelaySettingsStatusText(relayAvailabilityText: String) -> String {
        if relayAvailabilityText == "No relays are configured." {
            return "No relays are configured. Open Relay Settings before sharing."
        }
        if relayAvailabilityText == "All relays are turned off." {
            return "Relays are turned off. Open Relay Settings before sharing."
        }
        if relayAvailabilityText.hasPrefix("Sharing is off") {
            return "Sharing is off. Turn on Share for at least one relay."
        }
        return ""
    }

    static func relaySettingsRowHelperText(
        endpoint: NRConstants.RelayEndpoint,
        relayAvailabilityText: String,
        connectionCheck: RelayConnectionCheckResult? = nil
    ) -> String {
        if let recoveryDescription = connectionCheck?.recoveryDescription {
            return recoveryDescription
        }
        guard isSharingBlockedByRelaySettings(relayAvailabilityText: relayAvailabilityText),
              !endpoint.writeEnabled else {
            return ""
        }
        if endpoint.readEnabled {
            return "Turn on Share here to send location updates."
        }
        return "Turn on Share here before sending."
    }

    static func relaySettingsChangedStatusText(
        relayAvailabilityText: String,
        isResolvingStopSharingRetry: Bool = false
    ) -> String {
        if SwiftrootsConnectionStatusFormatter.canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            return isResolvingStopSharingRetry
                ? "Relay settings changed. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
                : "Relay settings changed. Reconnect to check current relay access."
        }
        return isResolvingStopSharingRetry
            ? "Relay settings changed. Turn on at least one relay before retrying Stop Sharing."
            : "Relay settings changed. Turn on at least one relay before reconnecting."
    }

    static func relaySettingsActionStatusText(
        actionText: String,
        relayAvailabilityText: String,
        isResolvingStopSharingRetry: Bool = false
    ) -> String {
        if SwiftrootsConnectionStatusFormatter.canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            let nextStep = isResolvingStopSharingRetry
                ? "Reconnect relays, then Retry Stop Sharing to tell people the session ended."
                : "Reconnect to check current relay access before sharing."
            return "\(actionText) \(nextStep)"
        }
        let nextStep = isResolvingStopSharingRetry
            ? "Turn on at least one relay before retrying Stop Sharing."
            : "Turn on at least one relay before reconnecting."
        return "\(actionText) \(nextStep)"
    }

    static func shouldBlockRecipientSheetRetry(
        hasRetryableSendFailures: Bool,
        didReconnect: Bool,
        relayCheckResults: [RelayConnectionCheckResult]
    ) -> Bool {
        hasRetryableSendFailures &&
            didReconnect &&
            SwiftrootsConnectionStatusFormatter.isSharingPathUnavailable(results: relayCheckResults)
    }

    static func shouldShowRecipientSheetReconnectButton(
        hasRetryableSendFailures: Bool,
        didReconnect: Bool
    ) -> Bool {
        hasRetryableSendFailures && !didReconnect
    }

    static func reconnectHelperText(serviceStatusText: String, retryWaitText: String = "") -> String {
        if !retryWaitText.isEmpty {
            return retryWaitText
        }
        switch reconnectReason(serviceStatusText: serviceStatusText) {
        case .stoppedListening:
            return "Reconnect before retrying invites or location updates."
        case .sendFailed:
            return "Reconnect now, then retry any pending invite or location update."
        case .stopFailed:
            return "Reconnect now, then retry Stop Sharing."
        case .restoredSession:
            return "Reconnect now to resume automatic updates, then Share Current Area to send now."
        case .connectFailed:
            return "Reconnect now to receive and send shared locations."
        case nil:
            return ""
        }
    }

    static func stopSharingButtonTitle(
        isStopping: Bool,
        serviceStatusText: String,
        hasPendingRetry: Bool = false
    ) -> String {
        if isStopping {
            return "Stopping..."
        }
        return needsStopSharingRetry(serviceStatusText: serviceStatusText, hasPendingRetry: hasPendingRetry)
            ? "Retry Stop Sharing"
            : "Stop Sharing"
    }

    static func stopSharingHelperText(
        serviceStatusText: String,
        didChangeRelaySettings: Bool = false,
        hasPendingRetry: Bool = false
    ) -> String {
        guard needsStopSharingRetry(serviceStatusText: serviceStatusText, hasPendingRetry: hasPendingRetry) else { return "" }
        if didChangeRelaySettings {
            return "Relay settings changed. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
        }
        if serviceStatusText.hasPrefix("Reconnected.") {
            return "Relays reconnected. Retry Stop Sharing to tell people the session ended."
        }
        return "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
    }

    static func automaticPublishingStatusText(
        isSharing: Bool,
        isPaused: Bool,
        serviceStatusText: String
    ) -> String {
        guard isSharing, isPaused else { return "" }
        switch reconnectReason(serviceStatusText: serviceStatusText) {
        case .sendFailed:
            return "Automatic updates are paused. Reconnect, then send the latest location."
        case .stopFailed:
            return "Automatic updates are paused. Reconnect, then retry Stop Sharing."
        case .restoredSession:
            return "Sharing was restored. Reconnect relays, then Share Current Area to send now."
        case .connectFailed:
            return "Automatic updates are paused until relays reconnect."
        case .stoppedListening, nil:
            return "Automatic updates are paused. Reconnect relays to resume."
        }
    }

    private static func needsStopSharingRetry(serviceStatusText: String, hasPendingRetry: Bool = false) -> Bool {
        if hasPendingRetry { return true }
        return reconnectReason(serviceStatusText: serviceStatusText) == .stopFailed ||
            serviceStatusText.contains("Retry Stop Sharing")
    }

    private enum ReconnectReason {
        case stoppedListening
        case connectFailed
        case sendFailed
        case stopFailed
        case restoredSession
    }

    private static func reconnectReason(serviceStatusText: String) -> ReconnectReason? {
        if SwiftrootsConnectionStatusFormatter.needsReconnect(serviceStatusText: serviceStatusText) {
            return .stoppedListening
        }
        if serviceStatusText.hasPrefix("Could not connect") ||
            serviceStatusText.hasPrefix("Could not listen") ||
            serviceStatusText.hasPrefix("Relay did not finish setup") ||
            serviceStatusText.hasPrefix("Relay did not respond") ||
            serviceStatusText.hasPrefix("Relay sent an unreadable response") {
            return .connectFailed
        }
        if serviceStatusText.hasPrefix("Sharing restored.") {
            return .restoredSession
        }
        if serviceStatusText.hasPrefix("Could not stop") ||
            serviceStatusText.hasPrefix("Could not confirm") ||
            serviceStatusText.hasPrefix("Relay rejected the stop") {
            return .stopFailed
        }
        if serviceStatusText.hasPrefix("Could not send") ||
            serviceStatusText.hasPrefix("Relay rejected") ||
            serviceStatusText.contains("Reconnect, then retry") ||
            serviceStatusText.contains("need checking or retrying") {
            return .sendFailed
        }
        return nil
    }
}
