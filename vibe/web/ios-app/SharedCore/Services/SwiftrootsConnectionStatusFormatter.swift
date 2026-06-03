import Foundation

enum SwiftrootsConnectionStatusFormatter {
    static func statusText(isAuthenticated: Bool, relayAvailabilityText: String, serviceStatusText: String = "") -> String {
        if isAuthenticated {
            return "Connected to relays"
        }
        switch relayRecoveryReason(serviceStatusText: serviceStatusText) {
        case .stoppedListening:
            return "Reconnect to receive updates"
        case .sendFailed:
            return "Reconnect to send updates"
        case .stopFailed:
            return "Reconnect to stop sharing"
        case .restoredSession:
            return "Reconnect relays"
        case .connectFailed:
            return "Reconnect relays"
        case nil:
            break
        }
        if relayAvailabilityText == "No relays are configured." {
            return "No relays configured"
        }
        if relayAvailabilityText == "All relays are turned off." {
            return "Relays are turned off"
        }
        if relayAvailabilityText.hasPrefix("Receiving is off") {
            return "Receiving is off"
        }
        if relayAvailabilityText.hasPrefix("Sharing is off") {
            return "Sharing is off"
        }
        return "Ready when you check relays or share"
    }

    static func needsReconnect(serviceStatusText: String) -> Bool {
        relayRecoveryReason(serviceStatusText: serviceStatusText) == .stoppedListening
    }

    static func canCheckRelays(relayAvailabilityText: String) -> Bool {
        relayAvailabilityText != "All relays are turned off." &&
            relayAvailabilityText != "No relays are configured."
    }

    static func checkRelaysButtonTitle(
        isChecking: Bool,
        relayAvailabilityText: String,
        serviceStatusText: String = "",
        retryWaitText: String = ""
    ) -> String {
        if isChecking {
            return "Checking..."
        }
        if !retryWaitText.isEmpty {
            return "Try Again Soon"
        }
        if relayRecoveryReason(serviceStatusText: serviceStatusText) != nil &&
            canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            return "Reconnect Relays"
        }
        if relayAvailabilityText == "No relays are configured." {
            return "Add a Relay First"
        }
        return canCheckRelays(relayAvailabilityText: relayAvailabilityText)
            ? "Check Relays"
            : "Turn On a Relay First"
    }

    static func checkRelaysHelperText(
        relayAvailabilityText: String,
        serviceStatusText: String = "",
        retryWaitText: String = ""
    ) -> String {
        if !retryWaitText.isEmpty {
            return retryWaitText
        }
        if canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            switch relayRecoveryReason(serviceStatusText: serviceStatusText) {
            case .stoppedListening:
            return "Relays stopped sending updates. Reconnect to receive new shared locations."
            case .sendFailed:
                return "Reconnect before retrying pending invites or location updates."
            case .stopFailed:
                return "Reconnect before retrying Stop Sharing."
            case .restoredSession:
                return "Reconnect to resume automatic sharing updates, then Share Current Area to send now."
            case .connectFailed:
                return "Reconnect to check current relay access."
            case nil:
                break
            }
        }
        if relayAvailabilityText == "All relays are turned off." {
            return "Turn on at least one relay before checking."
        }
        if relayAvailabilityText == "No relays are configured." {
            return "Add a relay before checking."
        }
        return ""
    }

    static func checkRelaysResultText(
        results: [RelayConnectionCheckResult],
        fallback: String,
        previousServiceStatusText: String = ""
    ) -> String {
        let recoveryReason = relayRecoveryReason(serviceStatusText: previousServiceStatusText)
        guard !results.isEmpty else {
            if case .stopFailed = recoveryReason {
                return "Reconnected. Retry Stop Sharing."
            }
            if case .restoredSession = recoveryReason {
                return reconnectRestoredSessionFallbackText(fallback)
            }
            return recoveryReason != nil ? reconnectFallbackText(fallback) : fallback
        }
        let connectedCount = results.filter { $0.state == .connected }.count
        let failedCount = results.filter { result in
            if case .failed = result.state { return true }
            return false
        }.count
        let wasReconnect = recoveryReason != nil
        if connectedCount > 0, failedCount == 0 {
            if case .stopFailed = recoveryReason {
                return "Reconnected. Retry Stop Sharing."
            }
            return wasReconnect
                ? "Reconnected. \(relayCountText(connectedCount)) reachable."
                : "\(relayCountText(connectedCount)) reachable."
        }
        if connectedCount > 0, failedCount > 0 {
            let partialText = "\(relayCountText(connectedCount)) reachable. \(failedRelaySummaryText(results: results))."
            let pathText = relayPathGuidanceText(results: results)
            let resultText = pathText.isEmpty ? partialText : "\(partialText) \(pathText)"
            if case .stopFailed = recoveryReason {
                return "Reconnected. \(resultText) Retry Stop Sharing."
            }
            if case .restoredSession = recoveryReason {
                if isSharingPathUnavailable(results: results) {
                    return "Reconnected. \(resultText) Open Relay Settings before using Share Current Area."
                }
                return "Reconnected. \(resultText) Share Current Area to send now."
            }
            return wasReconnect ? "Reconnected. \(resultText)" : resultText
        }
        if failedCount > 0 {
            let failureText = repeatedFailureCount(results: results) > 0
                ? " \(failedRelaySummaryText(results: results))."
                : ""
            if case .restoredSession = recoveryReason {
                return "Could not reconnect.\(failureText) Reconnect relays to resume automatic updates, then Share Current Area to send now."
            }
            return wasReconnect
                ? "Could not reconnect.\(failureText) Check your connection and try again."
                : "No relays reachable.\(failureText) Check your connection and try again."
        }
        return wasReconnect ? reconnectFallbackText(fallback) : fallback
    }

    static func recentRelayCheckText(summary: String, checkedAt: Date?, now: Date) -> String {
        let cleanSummary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanSummary.isEmpty else { return "" }
        guard let checkedAt else { return cleanSummary }

        let elapsedSeconds = max(0, Int(now.timeIntervalSince(checkedAt)))
        let ageText: String
        if elapsedSeconds < 60 {
            ageText = "just now"
        } else if elapsedSeconds < 3_600 {
            let minutes = max(1, elapsedSeconds / 60)
            ageText = minutes == 1 ? "1 minute ago" : "\(minutes) minutes ago"
        } else if elapsedSeconds < 86_400 {
            let hours = max(1, elapsedSeconds / 3_600)
            ageText = hours == 1 ? "1 hour ago" : "\(hours) hours ago"
        } else {
            let days = max(1, elapsedSeconds / 86_400)
            ageText = days == 1 ? "1 day ago" : "\(days) days ago"
        }
        let staleText = isRelayCheckStale(checkedAt: checkedAt, now: now)
            ? " Check relays for current reachability."
            : ""
        return "Last checked \(ageText): \(cleanSummary)\(staleText)"
    }

    static func retryWaitText(now: Date, nextAllowedAt: Date?) -> String {
        RelayReconnectCooldown.waitText(now: now, nextAllowedAt: nextAllowedAt)
    }

    static func relaySettingsChangedStatusText(
        relayAvailabilityText: String,
        isResolvingStopSharingRetry: Bool = false
    ) -> String {
        if canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            return isResolvingStopSharingRetry
                ? "Relay settings changed. Check relays, then Retry Stop Sharing to tell people the session ended."
                : "Relay settings changed. Check relays to update current reachability."
        }
        return isResolvingStopSharingRetry
            ? "Relay settings changed. Turn on at least one relay before retrying Stop Sharing."
            : "Relay settings changed. Turn on at least one relay before checking."
    }

    static func relaySettingsActionStatusText(
        actionText: String,
        relayAvailabilityText: String,
        isResolvingSharingRetry: Bool = false,
        isResolvingStopSharingRetry: Bool = false
    ) -> String {
        if canCheckRelays(relayAvailabilityText: relayAvailabilityText) {
            let nextStep: String
            if isResolvingStopSharingRetry {
                nextStep = "Check Relays, then Retry Stop Sharing to tell people the session ended."
            } else if isResolvingSharingRetry {
                nextStep = "Check Relays before retrying Start Sharing."
            } else {
                nextStep = "Check Relays before sharing."
            }
            return "\(actionText) \(nextStep)"
        }
        let nextStep = isResolvingStopSharingRetry
            ? "Turn on at least one relay before retrying Stop Sharing."
            : "Turn on at least one relay before checking."
        return "\(actionText) \(nextStep)"
    }

    static func relaySettingsSharingRetryRecoveryText(relayAvailabilityText: String) -> String {
        if relayAvailabilityText == "No relays are configured." {
            return "Add a Share relay before retrying Start Sharing."
        }
        if relayAvailabilityText == "All relays are turned off." {
            return "Turn on Share for a relay, then Check Relays before retrying Start Sharing."
        }
        if relayAvailabilityText.hasPrefix("Sharing is off") {
            return "Turn on Share for a relay, then Check Relays before retrying Start Sharing."
        }
        return "Check relays here, then retry Start Sharing."
    }

    static func relaySettingsSharingRetryEntryText() -> String {
        "Check relay settings, then Check Relays before retrying Start Sharing."
    }

    static func startSharingRelayCheckStatusText(
        relayAvailabilityText: String,
        relayCheckResults: [RelayConnectionCheckResult]
    ) -> String {
        guard NostrailRelayStatusFormatter.didRelaySettingsRecoverSharingPath(relayAvailabilityText: relayAvailabilityText) else {
            return "Sharing is still off. Turn on Share for at least one relay before retrying Start Sharing."
        }
        if isSharingPathUnavailable(results: relayCheckResults) {
            return "Sharing still has no reachable relay. Check Share toggles or try another relay before retrying Start Sharing."
        }
        return "Relay settings checked. Retry Start Sharing."
    }

    static func relaySettingsRowHelperText(
        endpoint: NRConstants.RelayEndpoint,
        relayAvailabilityText: String,
        connectionCheck: RelayConnectionCheckResult? = nil,
        isResolvingSharingRetry: Bool = false
    ) -> String {
        if let recoveryDescription = connectionCheck?.recoveryDescription {
            return recoveryDescription
        }
        if relayAvailabilityText == "All relays are turned off.",
           !endpoint.readEnabled,
           !endpoint.writeEnabled {
            return "Turn on Receive to get updates, or Share to send your own."
        }
        if relayAvailabilityText.hasPrefix("Receiving is off"),
           !endpoint.readEnabled {
            return "Turn on Receive here to get shared locations."
        }
        if relayAvailabilityText.hasPrefix("Sharing is off"),
           !endpoint.writeEnabled {
            return endpoint.readEnabled
                ? "Turn on Share here to send your own location."
                : "Turn on Share here before sharing."
        }
        if isResolvingSharingRetry,
           let connectionCheck {
            if connectionCheck.readEnabled,
               !connectionCheck.writeEnabled,
               connectionCheck.state == .connected {
                return "Receive works here. Turn on Share to use this relay for retries."
            }
        }
        return ""
    }

    static func sharingStatusText(isSharing: Bool) -> String {
        isSharing ? "Sharing active" : "Not sharing"
    }

    static func sharingStatusText(isSharing: Bool, sessionExpiresAtUnix: Int?, now: Date) -> String {
        guard isSharing else { return "Not sharing" }
        guard let sessionExpiresAtUnix else { return "Sharing active" }
        let remainingSeconds = sessionExpiresAtUnix - Int(now.timeIntervalSince1970)
        if remainingSeconds <= 0 {
            return "Sharing expired"
        }
        if remainingSeconds <= 300 {
            return "Sharing ending soon"
        }
        return "Sharing active"
    }

    static func sharingSessionDetailText(isSharing: Bool, sessionExpiresAtUnix: Int?, now: Date) -> String {
        guard isSharing else { return "" }
        guard let sessionExpiresAtUnix else {
            return "Session end time unavailable. Stop sharing before starting a new session."
        }
        let remainingSeconds = sessionExpiresAtUnix - Int(now.timeIntervalSince1970)
        if remainingSeconds <= 0 {
            return "Session ended. Clear it before starting a new sharing session."
        }
        if remainingSeconds < 60 {
            return "Ends in under 1 minute."
        }
        if remainingSeconds < 3_600 {
            let minutes = max(1, remainingSeconds / 60)
            return minutes == 1 ? "Ends in 1 minute." : "Ends in \(minutes) minutes."
        }
        let hours = max(1, remainingSeconds / 3_600)
        return hours == 1 ? "Ends in about 1 hour." : "Ends in about \(hours) hours."
    }

    static func activeSharingRecipientsText(isSharing: Bool, recipientDisplayValues: [String]) -> String {
        guard isSharing, !recipientDisplayValues.isEmpty else { return "" }
        let count = recipientDisplayValues.count
        let peopleText = count == 1 ? "1 person" : "\(count) people"
        return "Sharing with \(peopleText)."
    }

    static func startSharingSheetRecipients(
        currentRecipients: [String],
        activeSessionRecipientDisplayValues: [String],
        isSharing: Bool
    ) -> [String] {
        guard isSharing else { return currentRecipients }
        var mergedRecipients = currentRecipients
        for recipient in activeSessionRecipientDisplayValues {
            let normalizedRecipient = recipient.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalizedRecipient.isEmpty,
                  !mergedRecipients.contains(where: { $0.caseInsensitiveCompare(normalizedRecipient) == .orderedSame }) else {
                continue
            }
            mergedRecipients.append(normalizedRecipient)
        }
        return mergedRecipients
    }

    static func startSharingSheetContextText(
        visibleRecipients: [String],
        activeSessionRecipientDisplayValues: [String],
        isSharing: Bool
    ) -> String {
        guard isSharing, !visibleRecipients.isEmpty else { return "" }
        let restoredCount = activeSessionVisibleRecipientCount(
            visibleRecipients: visibleRecipients,
            activeSessionRecipientDisplayValues: activeSessionRecipientDisplayValues
        )
        let newCount = max(0, visibleRecipients.count - restoredCount)
        let restoredPeople = restoredCount == 1 ? "1 person" : "\(restoredCount) people"
        let newPeople = newCount == 1 ? "1 new person" : "\(newCount) new people"

        if restoredCount > 0, newCount > 0 {
            return "\(restoredPeople) already in this sharing session. \(newPeople) will be added when you share."
        }
        if restoredCount > 0 {
            return "\(restoredPeople) already in this sharing session. Share Current Area sends the latest approximate area."
        }
        if newCount > 0 {
            return "\(newPeople) will be added to this sharing session when you share."
        }
        return ""
    }

    static func stopSharingButtonTitle(isStopping: Bool, isSharing: Bool, sessionExpiresAtUnix: Int?, now: Date) -> String {
        if isStopping {
            return "Stopping..."
        }
        if sharingStatusText(isSharing: isSharing, sessionExpiresAtUnix: sessionExpiresAtUnix, now: now) == "Sharing expired" {
            return "Clear Expired Sharing"
        }
        return "Stop Sharing"
    }

    static func stopSharingButtonTitle(
        isStopping: Bool,
        isSharing: Bool,
        sessionExpiresAtUnix: Int?,
        now: Date,
        serviceStatusText: String,
        hasPendingRetry: Bool = false
    ) -> String {
        if isStopping {
            return "Stopping..."
        }
        if sharingStatusText(isSharing: isSharing, sessionExpiresAtUnix: sessionExpiresAtUnix, now: now) == "Sharing expired" {
            return "Clear Expired Sharing"
        }
        return stopSharingHelperText(serviceStatusText: serviceStatusText, hasPendingRetry: hasPendingRetry).isEmpty
            ? "Stop Sharing"
            : "Retry Stop Sharing"
    }

    static func stopSharingHelperText(
        serviceStatusText: String,
        didChangeRelaySettings: Bool = false,
        hasPendingRetry: Bool = false
    ) -> String {
        guard hasPendingRetry ||
                relayRecoveryReason(serviceStatusText: serviceStatusText) == .stopFailed ||
                serviceStatusText.contains("Retry Stop Sharing") else {
            return ""
        }
        if didChangeRelaySettings {
            return "Relay settings changed. Check relays, then Retry Stop Sharing to tell people the session ended."
        }
        if serviceStatusText.hasPrefix("Reconnected.") {
            return "Relays reconnected. Retry Stop Sharing to tell people the session ended."
        }
        return "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
    }

    static func sharingReadinessText(
        isSharing: Bool,
        relayAvailabilityText: String,
        lastRelayCheckSummary: String,
        didChangeRelaySettings: Bool,
        serviceStatusText: String = "",
        lastRelayCheckDate: Date? = nil,
        now: Date = Date()
    ) -> String {
        guard !isSharing else { return "" }
        if didChangeRelaySettings {
            return "Relay settings changed. Check relays before sharing."
        }
        if relayAvailabilityText == "No relays are configured." {
            return "Add a relay before sharing."
        }
        if relayAvailabilityText == "All relays are turned off." {
            return "Turn on at least one relay before sharing."
        }
        if relayAvailabilityText.hasPrefix("Sharing is off") {
            return "Turn on Share for at least one relay before sharing."
        }
        if relayRecoveryReason(serviceStatusText: serviceStatusText) != nil {
            return "Reconnect relays before sharing."
        }

        let cleanSummary = lastRelayCheckSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanSummary.isEmpty else {
            return canCheckRelays(relayAvailabilityText: relayAvailabilityText)
                ? "Check relays before sharing."
                : ""
        }
        if isRelayCheckStale(checkedAt: lastRelayCheckDate, now: now) {
            return "Check relays before sharing."
        }
        if cleanSummary == "No relays reachable. Check your connection and try again." ||
            cleanSummary == "Could not reconnect. Check your connection and try again." ||
            cleanSummary.contains("sharing has no reachable relay") {
            return "Fix relay reachability before sharing."
        }
        return "Relays checked for sharing."
    }

    static func activeSharingRelayWarningText(
        isSharing: Bool,
        lastRelayCheckSummary: String,
        lastRelayCheckDate: Date? = nil,
        now: Date = Date(),
        didChangeRelaySettings: Bool = false
    ) -> String {
        guard isSharing, !didChangeRelaySettings else { return "" }
        let cleanSummary = lastRelayCheckSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleanSummary.isEmpty, isRelayCheckStale(checkedAt: lastRelayCheckDate, now: now) {
            return "Check relays before Share Current Area."
        }
        if cleanSummary.contains("sharing has no reachable relay") {
            return "Sharing has no reachable relay. Open Relay Settings before Share Current Area."
        }
        if cleanSummary.hasPrefix("No relays reachable.") ||
            cleanSummary.hasPrefix("Could not reconnect.") {
            return "Reconnect relays before Share Current Area."
        }
        return ""
    }

    private static func isRelayCheckStale(checkedAt: Date?, now: Date) -> Bool {
        guard let checkedAt else { return false }
        return now.timeIntervalSince(checkedAt) >= 21_600
    }

    static func activeSharingSheetWarningText(isSharing: Bool, activeSharingRelayWarningText: String) -> String {
        guard isSharing else { return "" }
        return activeSharingRelayWarningText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func isActiveSharingSheetActionDisabled(isSharing: Bool, activeSharingRelayWarningText: String) -> Bool {
        !activeSharingSheetWarningText(
            isSharing: isSharing,
            activeSharingRelayWarningText: activeSharingRelayWarningText
        ).isEmpty
    }

    static func startSharingButtonTitle(isSharing: Bool, sharingReadinessText: String) -> String {
        if isSharing {
            return "Share Current Area"
        }
        return sharingReadinessText == "Relays checked for sharing." ? "Start Sharing" : "Prepare Sharing"
    }

    static func startSharingActionStatusText(sharingReadinessText: String) -> String {
        switch sharingReadinessText {
        case "Relay settings changed. Check relays before sharing.":
            return "Check relays before starting sharing."
        case "Add a relay before sharing.":
            return "Add a relay before starting sharing."
        case "Turn on at least one relay before sharing.":
            return "Turn on at least one relay before starting sharing."
        case "Turn on Share for at least one relay before sharing.":
            return "Turn on Share for at least one relay before starting sharing."
        case "Check relays before sharing.":
            return "Check relays before starting sharing."
        case "Fix relay reachability before sharing.":
            return "Fix relay reachability before starting sharing."
        case "Reconnect relays before sharing.":
            return "Reconnect relays before starting sharing."
        case "Relays checked for sharing.":
            return "Add people to start sharing. Relays are ready."
        default:
            return "Check relays before starting sharing."
        }
    }

    static func startSharingResultStatusText(
        sentCount: Int,
        failedLookupInputs: [String],
        failedSendInputs: [String],
        didUpdateExistingShare: Bool
    ) -> String {
        let notice = NostrailRecipientFeedbackFormatter.failureSummaryText(
            lookupInputs: failedLookupInputs,
            sendInputs: failedSendInputs
        )
        guard !notice.isEmpty else {
            return "\(successfulStartSharingResultPrefix(sentCount: sentCount, didUpdateExistingShare: didUpdateExistingShare))."
        }

        let prefix = sentCount == 0
            ? "No location updates sent"
            : successfulStartSharingResultPrefix(sentCount: sentCount, didUpdateExistingShare: didUpdateExistingShare)
        return "\(prefix). \(notice)"
    }

    static func shouldDismissStartSharingSheetAfterResult(hasFailures: Bool, didUpdateExistingShare: Bool) -> Bool {
        !hasFailures && !didUpdateExistingShare
    }

    static func didCompleteCurrentAreaUpdateAfterResult(hasFailures: Bool, didUpdateExistingShare: Bool) -> Bool {
        !hasFailures && didUpdateExistingShare
    }

    static func startSharingWaitingForLocationText(didUpdateExistingShare: Bool) -> String {
        didUpdateExistingShare
            ? "Finding your location. Swiftroots will share the current area after iOS returns an approximate area."
            : "Finding your location. Sharing will start after iOS returns an approximate area."
    }

    static func startSharingLocationWaitCanceledText() -> String {
        "Location request canceled. People stay selected for sharing later."
    }

    static func startSharingCurrentAreaReadyText() -> String {
        "Current approximate area ready."
    }

    static func startSharingInitialLocationPrompt() -> String {
        "Choose your current approximate area before sharing."
    }

    static func shouldReplaceStartSharingLocationStatusAfterFreshLocation(_ statusLine: String) -> Bool {
        statusLine == startSharingInitialLocationPrompt() ||
            statusLine == startSharingLocationWaitCanceledText() ||
            NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(statusLine) ||
            NostrailLocationStatusFormatter.isPermissionSettingsStatus(statusLine) ||
            statusLine == NostrailLocationStatusFormatter.permissionUnavailable
    }

    static func shouldClearStartSharingLocationStatusWhileEditing(_ statusLine: String) -> Bool {
        statusLine == startSharingLocationWaitCanceledText() ||
            NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(statusLine)
    }

    static func shouldShowStartSharingSheetDoneButton(
        isSharing: Bool,
        isBusy: Bool,
        didCompleteCurrentAreaUpdate: Bool,
        hasShareRetryFailures: Bool,
        retryableRecipientCount: Int
    ) -> Bool {
        isSharing &&
            !isBusy &&
            didCompleteCurrentAreaUpdate &&
            !hasShareRetryFailures &&
            retryableRecipientCount == 0
    }

    static func startSharingSheetCompletionHelperText(shouldShowDoneButton: Bool) -> String {
        shouldShowDoneButton ? "Rows marked Updated have the latest approximate area." : ""
    }

    static func shouldShowStartSharingSheetLocationSettings(statusLine: String) -> Bool {
        NostrailLocationStatusFormatter.isPermissionSettingsStatus(statusLine)
    }

    static func shouldRetryStartSharingSheetLocation(statusLine: String, hasLocationFix: Bool) -> Bool {
        !hasLocationFix && NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(statusLine)
    }

    static func startSharingSheetLocationSettingsHelperText(shouldShowLocationSettings: Bool) -> String {
        shouldShowLocationSettings ? "Enable location permission in Settings, then return and try sharing again." : ""
    }

    static func startSharingSheetLocationRetryHelperText(shouldRetryLocation: Bool) -> String {
        shouldRetryLocation ? "Try location again without changing the people selected." : ""
    }

    static func startSharingSheetLocationWaitHelperText(isFindingLocation: Bool) -> String {
        isFindingLocation ? "Cancel keeps people selected and stops this pending share." : ""
    }

    static func startSharingSheetButtonTitle(
        isStarting: Bool,
        isFindingLocation: Bool,
        shouldRetryLocation: Bool = false,
        hasShareRetryFailures: Bool,
        isSharing: Bool
    ) -> String {
        if isStarting {
            return isSharing ? "Sharing..." : "Starting..."
        }
        if isFindingLocation {
            return "Finding Location..."
        }
        if shouldRetryLocation {
            return "Try Location Again"
        }
        if hasShareRetryFailures {
            return "Retry Sharing"
        }
        return isSharing ? "Share Current Area" : "Start Sharing"
    }

    static func startSharingSheetButtonIcon(hasShareRetryFailures: Bool) -> String {
        hasShareRetryFailures ? "arrow.clockwise" : "location.circle.fill"
    }

    static func startSharingSheetHelperText(
        recipientCount: Int,
        retryableRecipientCount: Int,
        hasLocationFix: Bool,
        hasShareRetryFailures: Bool,
        didReconnect: Bool,
        isRetryBlockedByRelayPath: Bool,
        isSharing: Bool
    ) -> String {
        if isRetryBlockedByRelayPath {
            return "Sharing has no reachable relay. Open Relay Settings or reconnect before retrying rows marked Retry."
        }
        if hasShareRetryFailures {
            return didReconnect ? "Retry the rows marked Retry." : "Reconnect before retrying rows marked Retry."
        }
        if recipientCount == 0 {
            return "Add at least one person before sharing."
        }
        if retryableRecipientCount < recipientCount {
            return isSharing
                ? "Only pending people will receive this current-area update. Already-current people will not get a duplicate update."
                : "Only pending people will receive this sharing start. Already-current people will not get a duplicate update."
        }
        if hasLocationFix {
            return isSharing
                ? "Shares your current approximate area with \(NostrailRecipientFeedbackFormatter.personCountText(recipientCount))."
                : "Starts a 2-hour sharing session with \(NostrailRecipientFeedbackFormatter.personCountText(recipientCount))."
        }
        return isSharing
            ? "Swiftroots will ask iOS for your current approximate area before sharing it."
            : "Your location stays approximate, and iOS will ask permission before sharing."
    }

    static func isStartSharingSheetStartDisabled(
        recipientCount: Int,
        retryableRecipientCount: Int,
        isBusy: Bool,
        isRetryBlockedByRelayPath: Bool
    ) -> Bool {
        recipientCount == 0 || isBusy || retryableRecipientCount == 0 || isRetryBlockedByRelayPath
    }

    static func shouldShowStartSharingSheetReconnect(
        hasShareRetryFailures: Bool,
        didReconnect: Bool,
        isRetryBlockedByRelayPath: Bool
    ) -> Bool {
        (hasShareRetryFailures && !didReconnect) || isRetryBlockedByRelayPath
    }

    static func receivedLocationsText(count: Int) -> String {
        switch count {
        case 0:
            return "No fresh shared locations"
        case 1:
            return "1 fresh shared location"
        default:
            return "\(count) fresh shared locations"
        }
    }

    private static func relayCountText(_ count: Int) -> String {
        count == 1 ? "1 relay" : "\(count) relays"
    }

    private static func failedRelaySummaryText(results: [RelayConnectionCheckResult]) -> String {
        let failedCount = results.filter { result in
            if case .failed = result.state { return true }
            return false
        }.count
        let repeatedCount = repeatedFailureCount(results: results)
        if repeatedCount > 0 {
            let repeatedText = repeatedCount == 1 ? "1 relay keeps failing" : "\(repeatedCount) relays keep failing"
            let firstFailureCount = failedCount - repeatedCount
            guard firstFailureCount > 0 else { return repeatedText }
            let firstFailureText = firstFailureCount == 1 ? "1 relay could not connect" : "\(firstFailureCount) relays could not connect"
            return "\(repeatedText). \(firstFailureText)"
        }
        return "\(relayCountText(failedCount)) could not connect"
    }

    private static func repeatedFailureCount(results: [RelayConnectionCheckResult]) -> Int {
        results.filter { result in
            if case .failed = result.state {
                return result.consecutiveFailures >= 2
            }
            return false
        }.count
    }

    private static func successfulStartSharingResultPrefix(sentCount: Int, didUpdateExistingShare: Bool) -> String {
        let peopleText = NostrailRecipientFeedbackFormatter.personCountText(sentCount)
        return didUpdateExistingShare
            ? "Shared current area with \(peopleText)"
            : "Sharing started with \(peopleText)"
    }

    private static func activeSessionVisibleRecipientCount(
        visibleRecipients: [String],
        activeSessionRecipientDisplayValues: [String]
    ) -> Int {
        let activeRecipients = Set(
            activeSessionRecipientDisplayValues.map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            }.filter { !$0.isEmpty }
        )
        guard !activeRecipients.isEmpty else { return 0 }
        return visibleRecipients.reduce(0) { count, recipient in
            let normalizedRecipient = recipient.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return activeRecipients.contains(normalizedRecipient) ? count + 1 : count
        }
    }

    private static func reconnectFallbackText(_ fallback: String) -> String {
        fallback == "Relays ready." ? "Reconnected. Relays ready." : fallback
    }

    private static func reconnectRestoredSessionFallbackText(_ fallback: String) -> String {
        fallback == "Relays ready."
            ? "Reconnected. Automatic sharing updates can resume. Share Current Area to send now."
            : "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now."
    }

    private enum RelayRecoveryReason {
        case stoppedListening
        case connectFailed
        case sendFailed
        case stopFailed
        case restoredSession
    }

    private static func relayRecoveryReason(serviceStatusText: String) -> RelayRecoveryReason? {
        if serviceStatusText == "Relay stopped sending updates. Try reconnecting." {
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

    static func relayPathGuidanceText(results: [RelayConnectionCheckResult]) -> String {
        let enabledReadableCount = results.filter(\.readEnabled).count
        let enabledWritableCount = results.filter(\.writeEnabled).count
        let reachableReadableCount = results.filter { $0.readEnabled && $0.state == .connected }.count
        let reachableWritableCount = results.filter { $0.writeEnabled && $0.state == .connected }.count

        guard enabledReadableCount > 0, enabledWritableCount > 0 else { return "" }
        if reachableReadableCount > 0, reachableWritableCount == 0 {
            return "Receiving still works; sharing has no reachable relay."
        }
        if reachableWritableCount > 0, reachableReadableCount == 0 {
            return "Sharing still works; receiving has no reachable relay."
        }
        return ""
    }

    static func isSharingPathUnavailable(results: [RelayConnectionCheckResult]) -> Bool {
        let enabledWritableCount = results.filter(\.writeEnabled).count
        guard !results.isEmpty, enabledWritableCount > 0 else { return false }
        return !results.contains { $0.writeEnabled && $0.state == .connected }
    }
}
