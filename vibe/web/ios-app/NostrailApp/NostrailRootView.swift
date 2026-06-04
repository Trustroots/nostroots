import CoreLocation
import MapKit
import SwiftUI
import UIKit

struct NostrailRootView: View {
    @ObservedObject var sharingService: LocationSharingService

    @StateObject private var locationProvider = DeviceLocationProvider()
    @State private var recipients: [String] = []
    @State private var inviteMessage = "Sharing temporary location via Nostrail."
    @State private var latitude = 37.7749
    @State private var longitude = -122.4194
    @State private var hasLocationFix = false
    @State private var statusLine = ""
    @State private var recipientSheetNotice = ""
    @State private var recipientRowState = RecipientRowState()
    @State private var isRecipientSheetPresented = false
    @State private var isRelaySettingsPresented = false
    @State private var shouldReturnToRecipientSheetAfterRelaySettings = false
    @State private var didRecoverRecipientRelaysFromSettings = false
    @State private var didChangeRelaySettings = false
    @State private var hasPendingStopSharingRetry = false
    @State private var isClearKeyConfirmationPresented = false
    @State private var isSharingActionRunning = false
    @State private var isStopActionRunning = false
    @State private var isRelayReconnectRunning = false
    @State private var nextRelayReconnectAllowedAt: Date?
    @State private var relayReconnectFailureCount = 0
    @State private var shouldStartSharingAfterLocationFix = false
    @State private var unusedTrustrootsUsername = ""
    @State private var onboardingRecoveryNotice = ""
    @State private var currentAreaCode: String?
    @State private var region = MapCameraPosition.region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            span: MKCoordinateSpan(latitudeDelta: 1.0, longitudeDelta: 1.0)
        )
    )

    var body: some View {
        Group {
            if sharingService.hasImportedKey {
                mapExperience
            } else {
                NativeKeyOnboardingView(
                    appName: "Nostrail",
                    subtitle: "Nostrail shares your approximate location with people you choose, using your Nostr key and encrypted temporary events.",
                    requiresTrustrootsLink: false,
                    sharingService: sharingService,
                    trustrootsUsername: $unusedTrustrootsUsername,
                    recoveryNotice: onboardingRecoveryNotice,
                    onRecoveryNoticeCleared: {
                        onboardingRecoveryNotice = ""
                    }
                )
            }
        }
    }

    private var mapExperience: some View {
        NavigationStack {
            VStack(spacing: 12) {
                ZStack(alignment: .bottomTrailing) {
                    Map(position: $region) {
                        if hasLocationFix {
                            Marker("Current area", coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
                        }
                        ForEach(sharingService.receivedLocations) { item in
                            Marker(item.location.area, coordinate: CLLocationCoordinate2D(latitude: item.location.centerLat, longitude: item.location.centerLon))
                        }
                    }
                    .frame(minHeight: 340)

                    VStack(alignment: .trailing, spacing: 10) {
                        Button {
                            isRecipientSheetPresented = true
                        } label: {
                            Label(recipientButtonTitle, systemImage: "person.badge.plus")
                                .labelStyle(.titleAndIcon)
                        }
                        .buttonStyle(.borderedProminent)

                        Button {
                            statusLine = "Finding current location..."
                            locationProvider.requestCurrentLocation()
                        } label: {
                            Group {
                                if locationProvider.isRequestingLocation {
                                    ProgressView()
                                } else {
                                    Image(systemName: "location.fill")
                                        .font(.title3)
                                }
                            }
                            .frame(width: 42, height: 42)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(locationProvider.isRequestingLocation)
                        .accessibilityLabel("Go to current location")
                    }
                    .padding()
                }

                Form {
                    Section("Sharing") {
                        Button(sharingButtonTitle) {
                            startOrUpdateSharing()
                        }
                        .disabled(isSharingButtonDisabled)

                        Button(stopButtonTitle) {
                            stopSharing()
                        }
                        .disabled(isStopButtonDisabled)
                        if !stopSharingHelperText.isEmpty {
                            Text(stopSharingHelperText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Text(recipientSummary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !shareHelperText.isEmpty {
                            Text(shareHelperText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section("Status") {
                        Text(sharingService.statusText)
                        if !automaticPublishingStatusText.isEmpty {
                            Label(automaticPublishingStatusText, systemImage: "pause.circle")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                        if !activeSharingRelayWarningText.isEmpty {
                            Label(activeSharingRelayWarningText, systemImage: "exclamationmark.circle")
                                .font(.caption)
                                .foregroundStyle(.orange)
                            Button {
                                isRelaySettingsPresented = true
                            } label: {
                                Label("Open Relay Settings", systemImage: "slider.horizontal.3")
                            }
                        }
                        if !lastRelayCheckText.isEmpty {
                            Text(lastRelayCheckText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !relaySettingsStatusText.isEmpty {
                            Label(relaySettingsStatusText, systemImage: "antenna.radiowaves.left.and.right")
                                .font(.caption)
                                .foregroundStyle(.orange)
                            Button {
                                isRelaySettingsPresented = true
                            } label: {
                                Label("Open Relay Settings", systemImage: "slider.horizontal.3")
                            }
                        }
                        if shouldShowRelayReconnectAction {
                            Button {
                                reconnectRelays()
                            } label: {
                                Label(relayReconnectButtonTitle, systemImage: "antenna.radiowaves.left.and.right")
                            }
                            .disabled(isRelayReconnectDisabled)

                            Text(relayReconnectHelperText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let sessionExpiryText {
                            Label("Sharing until \(sessionExpiryText)", systemImage: "timer")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !statusLine.isEmpty {
                            Text(statusLine)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if isLocationPermissionStatus {
                                Button {
                                    openAppSettings()
                                } label: {
                                    Label("Open Settings", systemImage: "gearshape")
                                }
                            }
                        }
                        Text("Received: \(sharingService.receivedLocations.count)")
                            .font(.caption)
                        Label(sharingService.keyStorageStatus.userFacingDescription, systemImage: "checkmark.seal")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Nostrail")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let publicAddress {
                            Button {
                                UIPasteboard.general.string = publicAddress
                                statusLine = "Public address copied."
                            } label: {
                                Label("Copy Public Address", systemImage: "doc.on.doc")
                            }
                        }
                        Button {
                            isRelaySettingsPresented = true
                        } label: {
                            Label("Relay Settings", systemImage: "antenna.radiowaves.left.and.right")
                        }
                        Button("Clear Key", role: .destructive) {
                            requestClearKey()
                        }
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $isRecipientSheetPresented) {
                RecipientSheet(
                    recipients: $recipients,
                    notice: $recipientSheetNotice,
                    recipientRowState: $recipientRowState,
                    inviteMessage: $inviteMessage,
                    didRecoverFromRelaySettings: $didRecoverRecipientRelaysFromSettings,
                    canSendInvite: sharingService.hasImportedKey,
                    isSharing: sharingService.isSharing,
                    activeSharingRelayWarningText: activeSharingRelayWarningText,
                    onSendInvites: sendInvitesFromSheet,
                    onReconnectRelays: reconnectRelaysFromSheet,
                    onOpenRelaySettings: openRelaySettingsFromRecipientSheet,
                    onStartSharing: startOrUpdateSharing
                )
            }
            .sheet(
                isPresented: $isRelaySettingsPresented,
                onDismiss: returnToRecipientSheetIfNeeded
            ) {
                NostrailRelaySettingsSheet(
                    sharingService: sharingService,
                    isResolvingStopSharingRetry: hasPendingStopSharingRetry,
                    onReconnectRelays: reconnectRelaysFromSheet,
                    onRelayStateChanged: handleRelaySettingsChanged
                )
            }
            .onReceive(locationProvider.$coordinate.compactMap { $0 }) { coordinate in
                latitude = coordinate.latitude
                longitude = coordinate.longitude
                let areaCode = LocationSnapper.snap(latitude: latitude, longitude: longitude).areaCode
                let didMoveToNewArea = hasLocationFix && currentAreaCode != areaCode
                hasLocationFix = true
                currentAreaCode = areaCode
                sharingService.updateCurrentLocation(latitude: latitude, longitude: longitude)
                region = .region(
                    MKCoordinateRegion(
                        center: coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
                    )
                )
                if shouldStartSharingAfterLocationFix {
                    shouldStartSharingAfterLocationFix = false
                    startOrUpdateSharing()
                } else if didMoveToNewArea, sharingService.isSharing {
                    clearRecipientRowStates()
                    statusLine = NostrailRecipientActionFormatter.currentAreaChangedStatus
                } else {
                    statusLine = NostrailLocationStatusFormatter.currentAreaReady
                }
            }
            .onChange(of: locationProvider.statusText) { _, text in
                guard !text.isEmpty else { return }
                shouldStartSharingAfterLocationFix = false
                statusLine = text
            }
            .onAppear(perform: prepareInitialMapState)
            .onChange(of: recipients) { _, value in
                if value.isEmpty, shouldStartSharingAfterLocationFix {
                    shouldStartSharingAfterLocationFix = false
                    statusLine = "Sharing start canceled because no recipients are selected."
                    return
                }
                if NostrailLocationStatusFormatter.shouldClearAfterRecipientChange(statusLine) {
                    statusLine = ""
                }
            }
            .onChange(of: sharingService.isSharing) { _, isSharing in
                guard !isSharing else {
                    restoreVisibleRecipientsIfNeeded()
                    return
                }
                if recipientRowState.clearShareRetryState() {
                    recipientSheetNotice = ""
                }
            }
            .confirmationDialog(
                "Clear the key from this device?",
                isPresented: $isClearKeyConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Clear Key", role: .destructive) {
                    clearKey()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(NostrailKeyLifecycleGuard.clearKeyConfirmation)
            }
        }
    }

    private var recipientButtonTitle: String {
        NostrailRecipientActionFormatter.mapRecipientButtonTitle(count: recipients.count)
    }

    private func restoreVisibleRecipientsIfNeeded() {
        guard sharingService.isSharing,
              recipients.isEmpty,
              !sharingService.activeSessionRecipientDisplayValues.isEmpty else {
            return
        }
        recipients = sharingService.activeSessionRecipientDisplayValues
        recipientRowState.prune(to: recipients)
        if statusLine.isEmpty {
            statusLine = NostrailRecipientActionFormatter.restoredActiveSessionStatus(
                recipientCount: recipients.count
            )
        }
    }

    private func prepareInitialMapState() {
        restoreVisibleRecipientsIfNeeded()
        guard statusLine.isEmpty,
              !hasLocationFix,
              !sharingService.isSharing,
              !locationProvider.isRequestingLocation else {
            return
        }
        statusLine = NostrailLocationStatusFormatter.initialLocationPrompt
    }

    private var sharingButtonTitle: String {
        if recipients.isEmpty, !sharingService.isSharing {
            return NostrailRecipientActionFormatter.missingRecipientsShareButtonTitle
        }
        if shouldStartSharingAfterLocationFix {
            return "Waiting for Location..."
        }
        if shouldRetryLocation {
            return NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: sharingService.isSharing,
                containsSendRetry: false,
                containsLookupCheck: false,
                shouldRetryLocation: true
            )
        }
        if !hasLocationFix {
            return "Find Current Location"
        }
        return NostrailRecipientActionFormatter.shareButtonTitle(
            isRunning: isSharingActionRunning,
            isSharing: sharingService.isSharing,
            containsSendRetry: hasShareSendRetryFailures,
            containsLookupCheck: hasShareLookupFailures,
            shouldRetryLocation: shouldRetryLocation,
            allRecipientsCurrent: allShareRecipientsCurrent
        )
    }

    private var isSharingButtonDisabled: Bool {
        !sharingService.hasImportedKey ||
            isSharingActionRunning ||
            isStopActionRunning ||
            isRelayReconnectRunning ||
            shouldStartSharingAfterLocationFix ||
            (hasLocationFix && isSharingRelayPathUnavailable) ||
            allShareRecipientsCurrent
    }

    private var stopButtonTitle: String {
        if shouldStartSharingAfterLocationFix {
            return "Cancel Location Request"
        }
        return NostrailRelayStatusFormatter.stopSharingButtonTitle(
            isStopping: isStopActionRunning,
            serviceStatusText: sharingService.statusText,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private var stopSharingHelperText: String {
        NostrailRelayStatusFormatter.stopSharingHelperText(
            serviceStatusText: sharingService.statusText,
            didChangeRelaySettings: didChangeRelaySettings,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private var isStopButtonDisabled: Bool {
        if shouldStartSharingAfterLocationFix {
            return isSharingActionRunning || isStopActionRunning
        }
        return !sharingService.isSharing || isSharingActionRunning || isStopActionRunning
    }

    private var shouldShowRelayReconnectAction: Bool {
        NostrailRelayStatusFormatter.shouldShowReconnect(
            isAuthenticated: sharingService.isAuthenticated,
            serviceStatusText: sharingService.statusText,
            relayAvailabilityText: sharingService.relayAvailabilityText
        )
    }

    private var isRelayReconnectDisabled: Bool {
        isRelayReconnectRunning ||
            isSharingActionRunning ||
            isStopActionRunning ||
            !relayReconnectRetryWaitText.isEmpty
    }

    private var relayReconnectButtonTitle: String {
        NostrailRelayStatusFormatter.reconnectButtonTitle(
            isRunning: isRelayReconnectRunning,
            retryWaitText: relayReconnectRetryWaitText
        )
    }

    private var relayReconnectHelperText: String {
        NostrailRelayStatusFormatter.reconnectHelperText(
            serviceStatusText: sharingService.statusText,
            retryWaitText: relayReconnectRetryStatusText
        )
    }

    private var automaticPublishingStatusText: String {
        NostrailRelayStatusFormatter.automaticPublishingStatusText(
            isSharing: sharingService.isSharing,
            isPaused: sharingService.isAutomaticPublishingPaused,
            serviceStatusText: sharingService.statusText
        )
    }

    private var activeSharingRelayWarningText: String {
        SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
            isSharing: sharingService.isSharing,
            lastRelayCheckSummary: sharingService.lastRelayCheckSummary,
            lastRelayCheckDate: sharingService.lastRelayCheckDate,
            didChangeRelaySettings: didChangeRelaySettings
        )
    }

    private var relayReconnectRetryWaitText: String {
        RelayReconnectCooldown.waitText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults
        )
    }

    private var relayReconnectRetryStatusText: String {
        RelayReconnectCooldown.retryStatusText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults,
            readyText: "Reconnect now."
        )
    }

    private var relaySettingsStatusText: String {
        NostrailRelayStatusFormatter.mapRelaySettingsStatusText(
            relayAvailabilityText: sharingService.relayAvailabilityText
        )
    }

    private var isSharingRelayPathUnavailable: Bool {
        NostrailRelayStatusFormatter.isSharingBlockedByRelaySettings(
            relayAvailabilityText: sharingService.relayAvailabilityText
        )
    }

    private var shouldRetryLocation: Bool {
        NostrailRecipientActionFormatter.shouldRetryLocation(
            statusLine: statusLine,
            hasLocationFix: hasLocationFix
        )
    }

    private var recipientSummary: String {
        NostrailRecipientSummaryFormatter.sharingSummary(
            recipients: recipients,
            hasLocationFix: hasLocationFix,
            isWaitingForLocation: shouldStartSharingAfterLocationFix
        )
    }

    private var shareHelperText: String {
        let locationRetryNote = NostrailRecipientActionFormatter.locationRetryNote(
            shouldRetryLocation: shouldRetryLocation,
            recipientCount: recipients.count,
            isSharing: sharingService.isSharing
        )
        if !locationRetryNote.isEmpty {
            return locationRetryNote
        }
        let readinessNote = NostrailRecipientActionFormatter.shareReadinessNote(
            hasLocationFix: hasLocationFix,
            isWaitingForLocation: shouldStartSharingAfterLocationFix,
            recipientCount: recipients.count,
            isSharing: sharingService.isSharing
        )
        guard readinessNote.isEmpty else { return readinessNote }
        if isSharingRelayPathUnavailable {
            return relaySettingsStatusText
        }
        return NostrailRecipientActionFormatter.sharePendingNote(
            isSharing: sharingService.isSharing,
            visibleCount: recipients.count,
            pendingCount: shareRetryRecipients.count
        )
    }

    private var isLocationPermissionStatus: Bool {
        NostrailLocationStatusFormatter.isPermissionSettingsStatus(statusLine)
    }

    private var publicAddress: String? {
        guard let pubkey = sharingService.publicKeyHex else { return nil }
        return try? NIP19.encodeNpub(pubkeyHex: pubkey)
    }

    private var lastRelayCheckText: String {
        SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
            summary: sharingService.lastRelayCheckSummary,
            checkedAt: sharingService.lastRelayCheckDate,
            now: Date()
        )
    }

    private var sessionExpiryText: String? {
        guard sharingService.isSharing,
              let expiresAt = sharingService.sessionExpiresAtUnix else {
            return nil
        }
        return Date(timeIntervalSince1970: TimeInterval(expiresAt))
            .formatted(date: .omitted, time: .shortened)
    }

    private func sendInvitesFromSheet(_ attemptedRecipients: [String]) async throws -> RecipientSheetSendResult {
        let result = try await sharingService.publishInviteReportingFailures(to: attemptedRecipients, message: inviteMessage)
        let message: String
        if result.hasFailures {
            recipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedLookupInputs: result.failedLookupInputs,
                failedSendInputs: result.failedSendInputs,
                purpose: .invite
            )
            recipientSheetNotice = recipientFailureText(result.failedLookupInputs, result.failedSendInputs)
            message = result.sentCount == 0
                ? "No invites sent. \(recipientSheetNotice)"
                : "Invite sent to \(personCountText(result.sentCount)). \(recipientSheetNotice)"
        } else {
            recipientSheetNotice = ""
            recipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedInputs: [],
                purpose: .invite
            )
            message = "Invite sent to \(personCountText(result.sentCount))."
        }
        statusLine = message
        return RecipientSheetSendResult(
            message: message,
            shouldDismiss: !result.hasFailures,
            failedLookupInputs: result.failedLookupInputs,
            failedSendInputs: result.failedSendInputs
        )
    }

    private func startOrUpdateSharing() {
        if recipients.isEmpty, !sharingService.isSharing {
            statusLine = "Add at least one recipient before sharing."
            isRecipientSheetPresented = true
            return
        }
        guard hasLocationFix else {
            shouldStartSharingAfterLocationFix = true
            statusLine = "Finding your location. Sharing will start after iOS returns an approximate area."
            locationProvider.requestCurrentLocation()
            return
        }
        guard !isSharingActionRunning, !isStopActionRunning else { return }
        let attemptedRecipients = shareRetryRecipients
        let canUpdateActiveSessionWithoutVisibleRecipients = sharingService.isSharing && recipients.isEmpty
        guard canUpdateActiveSessionWithoutVisibleRecipients || !attemptedRecipients.isEmpty else {
            statusLine = "Everyone selected already has the latest update."
            return
        }
        isSharingActionRunning = true
        statusLine = NostrailRecipientActionFormatter.shareActionStatus(
            isSharing: sharingService.isSharing,
            containsSendRetry: attemptedRecipients.contains { recipientRowState.needingRetry.contains($0) },
            containsLookupCheck: attemptedRecipients.contains { recipientRowState.needingAttention.contains($0) }
        )
        Task {
            defer { isSharingActionRunning = false }
            do {
                sharingService.updateCurrentLocation(latitude: latitude, longitude: longitude)
                if sharingService.isSharing, recipients.isEmpty {
                    try await sharingService.updateSharedLocation(latitude: latitude, longitude: longitude)
                    clearRecipientRowStates()
                    didChangeRelaySettings = false
                    statusLine = "Current area shared with the active session."
                } else if sharingService.isSharing {
                    let result = try await sharingService.updateSharedLocationReportingFailures(recipients: attemptedRecipients, latitude: latitude, longitude: longitude)
                    handleSharePublishResult(
                        result,
                        attemptedRecipients: attemptedRecipients,
                        successMessage: "Location updated for \(personCountText(result.sentCount))."
                    )
                } else {
                    let result = try await sharingService.startSessionReportingFailures(
                        recipients: attemptedRecipients,
                        initialLatitude: latitude,
                        initialLongitude: longitude
                    )
                    handleSharePublishResult(
                        result,
                        attemptedRecipients: attemptedRecipients,
                        successMessage: "Sharing started with \(personCountText(result.sentCount))."
                    )
                }
            } catch {
                if isRecipientResolutionFailure(error) {
                    handleShareResolutionFailure(attemptedRecipients: attemptedRecipients)
                } else if NostrailActionErrorFormatter.isRetryableRelayFailure(error) {
                    handleShareSendFailure(attemptedRecipients: attemptedRecipients)
                } else {
                    statusLine = nostrailUserFacingMessage(for: error, serviceStatusText: sharingService.statusText)
                }
            }
        }
    }

    private func handleShareResolutionFailure(attemptedRecipients: [String]) {
        recipientRowState.markPublishResult(
            attemptedRecipients: attemptedRecipients,
            failedInputs: attemptedRecipients,
            purpose: .shareRetry
        )
        recipientSheetNotice = recipientCorrectionText(attemptedRecipients)
        statusLine = "No location updates sent. \(recipientSheetNotice)"
        isRecipientSheetPresented = true
    }

    private func handleShareSendFailure(attemptedRecipients: [String]) {
        recipientRowState.markPublishResult(
            attemptedRecipients: attemptedRecipients,
            failedLookupInputs: [],
            failedSendInputs: attemptedRecipients,
            purpose: .shareRetry
        )
        recipientSheetNotice = recipientFailureText([], attemptedRecipients)
        statusLine = "No location updates sent. \(recipientSheetNotice)"
        isRecipientSheetPresented = true
    }

    private func handleSharePublishResult(_ result: SharePublishResult, attemptedRecipients: [String], successMessage: String) {
        if result.hasFailures {
            recipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedLookupInputs: result.failedLookupInputs,
                failedSendInputs: result.failedSendInputs,
                purpose: .shareRetry
            )
            recipientSheetNotice = recipientFailureText(result.failedLookupInputs, result.failedSendInputs)
            let baseMessage = result.sentCount == 0 ? "No location updates sent." : successMessage
            statusLine = "\(baseMessage) \(recipientSheetNotice)"
            isRecipientSheetPresented = true
        } else {
            recipientSheetNotice = ""
            recipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedInputs: [],
                purpose: .shareRetry
            )
            didChangeRelaySettings = false
            statusLine = successMessage
        }
    }

    private var shareRetryRecipients: [String] {
        recipientRowState.shareRetryRecipients(from: recipients)
    }

    private var hasShareSendRetryFailures: Bool {
        shareRetryRecipients.contains { recipientRowState.needingRetry.contains($0) }
    }

    private var hasShareLookupFailures: Bool {
        shareRetryRecipients.contains { recipientRowState.needingAttention.contains($0) }
    }

    private var allShareRecipientsCurrent: Bool {
        hasLocationFix && sharingService.isSharing && !recipients.isEmpty && shareRetryRecipients.isEmpty
    }

    private func clearRecipientRowStates() {
        recipientSheetNotice = ""
        didRecoverRecipientRelaysFromSettings = false
        recipientRowState.clear()
    }

    private func personCountText(_ count: Int) -> String {
        NostrailRecipientFeedbackFormatter.personCountText(count)
    }

    private func recipientCorrectionText(_ failedInputs: [String]) -> String {
        NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: failedInputs, sendInputs: [])
    }

    private func recipientFailureText(_ lookupInputs: [String], _ sendInputs: [String]) -> String {
        NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: lookupInputs, sendInputs: sendInputs)
    }

    private func stopSharing() {
        if shouldStartSharingAfterLocationFix {
            locationProvider.cancelCurrentLocationRequest()
            shouldStartSharingAfterLocationFix = false
            statusLine = NostrailRecipientActionFormatter.locationWaitCanceledText()
            return
        }
        guard sharingService.isSharing, !isSharingActionRunning, !isStopActionRunning else { return }
        isStopActionRunning = true
        statusLine = "Stopping sharing..."
        Task {
            defer { isStopActionRunning = false }
            do {
                try await sharingService.stopSession()
                clearRecipientRowStates()
                didChangeRelaySettings = false
                hasPendingStopSharingRetry = false
                statusLine = "Sharing stopped."
            } catch {
                hasPendingStopSharingRetry = sharingService.isSharing
                statusLine = nostrailUserFacingMessage(for: error, serviceStatusText: sharingService.statusText, relayContext: .stop)
            }
        }
    }

    private func requestClearKey() {
        if let message = NostrailKeyLifecycleGuard.blockedClearKeyMessage(
            isSharing: sharingService.isSharing,
            isStopping: isStopActionRunning
        ) {
            statusLine = message
            return
        }
        if shouldStartSharingAfterLocationFix {
            shouldStartSharingAfterLocationFix = false
            statusLine = NostrailKeyLifecycleGuard.pendingShareStartCancelMessage
        }
        isClearKeyConfirmationPresented = true
    }

    private func clearKey() {
        if let message = NostrailKeyLifecycleGuard.blockedClearKeyMessage(
            isSharing: sharingService.isSharing,
            isStopping: isStopActionRunning
        ) {
            statusLine = message
            return
        }
        shouldStartSharingAfterLocationFix = false
        do {
            try sharingService.clearKey()
            recipients = []
            clearRecipientRowStates()
            recipientSheetNotice = ""
            isRecipientSheetPresented = false
            isRelaySettingsPresented = false
            shouldReturnToRecipientSheetAfterRelaySettings = false
            didRecoverRecipientRelaysFromSettings = false
            didChangeRelaySettings = false
            hasLocationFix = false
            currentAreaCode = nil
            statusLine = ""
            isSharingActionRunning = false
            isStopActionRunning = false
            isRelayReconnectRunning = false
            hasPendingStopSharingRetry = false
            nextRelayReconnectAllowedAt = nil
            relayReconnectFailureCount = 0
            onboardingRecoveryNotice = NativeOnboardingKeyLifecycleMessage.clearKeySuccess(
                storageStatus: sharingService.keyStorageStatus
            )
        } catch {
            statusLine = NativeOnboardingKeyLifecycleMessage.clearKeyFailure(
                error: error,
                requiresTrustrootsLink: false
            )
        }
    }

    private func reconnectRelays() {
        guard shouldShowRelayReconnectAction, !isRelayReconnectDisabled else { return }
        let previousServiceStatusText = sharingService.statusText
        nextRelayReconnectAllowedAt = nil
        isRelayReconnectRunning = true
        statusLine = "Reconnecting..."
        Task {
            defer { isRelayReconnectRunning = false }
            do {
                let relayCheckResults = try await reconnectRelaysFromSheet()
                nextRelayReconnectAllowedAt = nil
                relayReconnectFailureCount = 0
                statusLine = NostrailRelayStatusFormatter.reconnectSuccessText(
                    previousServiceStatusText: previousServiceStatusText,
                    relayCheckResults: relayCheckResults,
                    canShareCurrentArea: hasLocationFix
                )
            } catch {
                startRelayReconnectRetryCooldown(relayCheckResults: sharingService.relayConnectionCheckResults)
                let errorMessage = nostrailUserFacingMessage(
                    for: error,
                    serviceStatusText: sharingService.statusText,
                    relayContext: .connect
                )
                statusLine = NostrailRelayStatusFormatter.reconnectFailureText(
                    previousServiceStatusText: previousServiceStatusText,
                    errorMessage: errorMessage
                )
            }
        }
    }

    private func startRelayReconnectRetryCooldown(relayCheckResults: [RelayConnectionCheckResult] = []) {
        relayReconnectFailureCount += 1
        let failureCount = RelayReconnectCooldown.effectiveFailureCount(
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: relayCheckResults
        )
        let delay = RelayReconnectCooldown.delay(afterConsecutiveFailures: failureCount)
        let nextAllowedAt = RelayReconnectCooldown.nextAllowedAt(delay: delay)
        self.nextRelayReconnectAllowedAt = nextAllowedAt
        Task {
            try? await Task.sleep(for: .seconds(delay))
            guard self.nextRelayReconnectAllowedAt == nextAllowedAt else { return }
            self.nextRelayReconnectAllowedAt = nil
        }
    }

    private func reconnectRelaysFromSheet() async throws -> [RelayConnectionCheckResult] {
        try await sharingService.authenticate()
        didChangeRelaySettings = false
        return sharingService.relayConnectionCheckResults
    }

    private func openRelaySettingsFromRecipientSheet() {
        shouldReturnToRecipientSheetAfterRelaySettings = true
        isRecipientSheetPresented = false
        DispatchQueue.main.async {
            isRelaySettingsPresented = true
        }
    }

    private func handleRelaySettingsChanged(_ relayAvailabilityText: String) {
        nextRelayReconnectAllowedAt = nil
        relayReconnectFailureCount = 0
        didChangeRelaySettings = true
        statusLine = NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
            relayAvailabilityText: relayAvailabilityText,
            isResolvingStopSharingRetry: hasPendingStopSharingRetry
        )
        guard shouldReturnToRecipientSheetAfterRelaySettings else { return }
        didRecoverRecipientRelaysFromSettings = false
        recipientSheetNotice = NostrailRelayStatusFormatter.recipientSheetRelaySettingsChangedStatusText(
            relayAvailabilityText: relayAvailabilityText
        )
    }

    private func returnToRecipientSheetIfNeeded() {
        guard shouldReturnToRecipientSheetAfterRelaySettings else { return }
        shouldReturnToRecipientSheetAfterRelaySettings = false
        guard sharingService.hasImportedKey,
              !recipients.isEmpty,
              !recipientRowState.needingRetry.isEmpty else {
            return
        }
        DispatchQueue.main.async {
            isRecipientSheetPresented = true
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

}

private func nostrailUserFacingMessage(
    for error: Error,
    serviceStatusText: String? = nil,
    relayContext: RelayUserFacingMessageFormatter.Context = .publish
) -> String {
    NostrailActionErrorFormatter.message(
        for: error,
        serviceStatusText: serviceStatusText,
        relayContext: relayContext
    )
}

private func isRecipientResolutionFailure(_ error: Error) -> Bool {
    guard let serviceError = error as? LocationSharingServiceError else { return false }
    if case .recipientResolutionFailed = serviceError {
        return true
    }
    return false
}

private struct RecipientSheetSendResult {
    let message: String
    let shouldDismiss: Bool
    let failedInputs: [String]
    let failedLookupInputs: [String]
    let failedSendInputs: [String]

    init(message: String, shouldDismiss: Bool, failedInputs: [String]) {
        self.message = message
        self.shouldDismiss = shouldDismiss
        self.failedInputs = failedInputs
        self.failedLookupInputs = failedInputs
        self.failedSendInputs = []
    }

    init(
        message: String,
        shouldDismiss: Bool,
        failedLookupInputs: [String],
        failedSendInputs: [String]
    ) {
        self.message = message
        self.shouldDismiss = shouldDismiss
        self.failedLookupInputs = failedLookupInputs
        self.failedSendInputs = failedSendInputs
        self.failedInputs = failedLookupInputs + failedSendInputs
    }
}

private struct RecipientSheet: View {
    private enum FocusedField {
        case recipient
        case inviteMessage
    }

    @Binding var recipients: [String]
    @Binding var notice: String
    @Binding var recipientRowState: RecipientRowState
    @Binding var inviteMessage: String
    @Binding var didRecoverFromRelaySettings: Bool
    let canSendInvite: Bool
    let isSharing: Bool
    let activeSharingRelayWarningText: String
    let onSendInvites: ([String]) async throws -> RecipientSheetSendResult
    let onReconnectRelays: () async throws -> [RelayConnectionCheckResult]
    let onOpenRelaySettings: () -> Void
    let onStartSharing: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var newRecipient = ""
    @State private var statusLine = ""
    @State private var isSending = false
    @State private var isReconnecting = false
    @State private var nextRelayReconnectAllowedAt: Date?
    @State private var relayReconnectFailureCount = 0
    @State private var didReconnectFromSheet = false
    @State private var sheetReconnectRelayCheckResults: [RelayConnectionCheckResult] = []
    @FocusState private var focusedField: FocusedField?

    var body: some View {
        NavigationStack {
            Form {
                if !notice.isEmpty {
                    Section {
                        Label(notice, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }

                Section("Add Recipient") {
                    TextField("Trustroots username, profile link, NIP-05, npub, or pubkey", text: $newRecipient)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .recipient)
                        .submitLabel(.done)
                        .onChange(of: newRecipient) { _, _ in
                            clearCorrectableStatus()
                        }
                        .onSubmit(addRecipient)
                    Button("Add") {
                        addRecipient()
                    }
                    .disabled(newRecipient.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)

                    Button {
                        pasteAndAddRecipient()
                    } label: {
                        Label("Paste and Add", systemImage: "doc.on.clipboard")
                    }
                    .disabled(isBusy)
                }

                Section("Recipients") {
                    if recipients.isEmpty {
                        Text(NostrailRecipientSummaryFormatter.recipientSheetEmptyText)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(recipients, id: \.self) { recipient in
                            let displayStatus = recipientRowState.displayStatus(for: recipient)
                            HStack(spacing: 10) {
                                if let imageName = displayStatus.systemImage,
                                   let accessibilityLabel = displayStatus.accessibilityLabel {
                                    Image(systemName: imageName)
                                        .foregroundStyle(displayStatus == .sent(recipientRowState.sentLabel) ? .green : .orange)
                                        .frame(width: 20)
                                        .accessibilityLabel(accessibilityLabel)
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(NostrailRecipientSummaryFormatter.shortDisplayName(recipient))
                                        .font(.system(.body, design: .monospaced))
                                        .lineLimit(1)
                                        .truncationMode(.middle)
                                        .accessibilityLabel(recipient)
                                    if let detailText = recipientRowDetailText(for: displayStatus) {
                                        Text(detailText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                    }
                                }
                                .layoutPriority(1)
                                .contextMenu {
                                    Button {
                                        UIPasteboard.general.string = recipient
                                        statusLine = "Recipient copied."
                                    } label: {
                                        Label("Copy Recipient", systemImage: "doc.on.doc")
                                    }
                                }
                                Spacer()
                                if displayStatus == .check {
                                    Button {
                                        editRecipient(recipient)
                                    } label: {
                                        Image(systemName: "pencil")
                                            .frame(width: 32, height: 32)
                                    }
                                    .buttonStyle(.borderless)
                                    .disabled(isBusy)
                                    .accessibilityLabel("Edit recipient")
                                }
                                if let label = displayStatus.label {
                                    Text(label)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(minWidth: 52, alignment: .trailing)
                                }
                            }
                        }
                        .onDelete(perform: removeRecipients)
                        .deleteDisabled(isBusy)
                    }
                }

                Section("Share") {
                    Text(startSharingHelperText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Invite") {
                    TextField("Invite message", text: $inviteMessage, axis: .vertical)
                        .lineLimit(2...4)
                        .focused($focusedField, equals: .inviteMessage)
                        .onChange(of: inviteMessage) { _, _ in
                            guard !isBusy else { return }
                            clearCorrectableStatus()
                        }
                    if !sendInvitesHelperText.isEmpty {
                        Text(sendInvitesHelperText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !statusLine.isEmpty {
                        Text(statusLine)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Recipients")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom) {
                recipientActionBar
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .disabled(isBusy)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        focusedField = nil
                    }
                }
            }
        }
        .interactiveDismissDisabled(isBusy)
    }

    private var recipientActionBar: some View {
        VStack(spacing: 8) {
            if isActiveSharingBlockedByRelayPath {
                Label(activeSharingSheetWarningText, systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }

            if shouldShowSheetReconnectButton {
                Button {
                    reconnectFromSheet()
                } label: {
                    Label(
                        NostrailRelayStatusFormatter.reconnectButtonTitle(
                            isRunning: isReconnecting,
                            retryWaitText: relayReconnectRetryWaitText
                        ),
                        systemImage: "antenna.radiowaves.left.and.right"
                    )
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isSheetReconnectDisabled)
            }

            if shouldPrioritizeInviteRetry {
                inviteActionButton
                    .buttonStyle(.borderedProminent)
                shareActionButton
                    .buttonStyle(.bordered)
            } else {
                shareActionButton
                    .buttonStyle(.borderedProminent)
                inviteActionButton
                    .buttonStyle(.bordered)
            }

            if !bottomActionHelperText.isEmpty {
                Text(bottomActionHelperText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if isRetrySendBlockedByRelayPath || isActiveSharingBlockedByRelayPath {
                Button {
                    dismiss()
                    onOpenRelaySettings()
                } label: {
                    Label("Open Relay Settings", systemImage: "slider.horizontal.3")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isBusy)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private var shareActionButton: some View {
        Button {
            focusedField = nil
            didRecoverFromRelaySettings = false
            dismiss()
            onStartSharing()
        } label: {
            Label(shareSheetButtonTitle, systemImage: hasShareSendRetryFailures ? "arrow.clockwise" : shareSheetButtonIcon)
                .frame(maxWidth: .infinity)
        }
        .controlSize(.large)
        .disabled(recipients.isEmpty || isBusy || allShareRecipientsCurrent || isShareRetryBlockedByRelayPath || isActiveSharingBlockedByRelayPath)
    }

    private var inviteActionButton: some View {
        Button {
            focusedField = nil
            sendInvites()
        } label: {
            Label(sendInvitesButtonTitle, systemImage: hasInviteSendRetryFailures ? "arrow.clockwise" : "paperplane")
                .frame(maxWidth: .infinity)
        }
        .controlSize(.large)
        .disabled(!canSendInvite || retryableRecipients.isEmpty || isBusy || isInviteRetryBlockedByRelayPath)
    }

    private var sendInvitesButtonTitle: String {
        NostrailRecipientActionFormatter.inviteButtonTitle(
            isSending: isSending,
            pendingCount: retryableRecipients.count,
            allInvitesSent: allVisibleInvitesSent,
            containsSendRetry: hasInviteSendRetryFailures,
            containsLookupCheck: hasInviteLookupFailures
        )
    }

    private var sendInvitesHelperText: String {
        NostrailRecipientActionFormatter.invitePendingNote(
            visibleCount: recipients.count,
            pendingCount: retryableRecipients.count,
            allInvitesSent: allVisibleInvitesSent
        )
    }

    private var startSharingHelperText: String {
        let pendingNote = NostrailRecipientActionFormatter.sharePendingNote(
            isSharing: isSharing,
            visibleCount: recipients.count,
            pendingCount: shareRetryRecipients.count
        )
        if !pendingNote.isEmpty {
            return pendingNote
        }
        return NostrailRecipientActionFormatter.shareStartSheetNote(
            recipientCount: recipients.count,
            isSendingInvite: isSending,
            isSharing: isSharing
        )
    }

    private var bottomActionHelperText: String {
        if !relayReconnectRetryStatusText.isEmpty {
            return relayReconnectRetryStatusText
        }
        if isRetrySendBlockedByRelayPath {
            return NostrailRelayStatusFormatter.recipientSheetBlockedRetryText
        }
        if hasSheetSendRetryFailures {
            return NostrailRelayStatusFormatter.recipientSheetRetryHelperText(didReconnect: didRestoreRetryPath)
        }
        if !sendInvitesHelperText.isEmpty {
            return sendInvitesHelperText
        }
        return startSharingHelperText
    }

    private var shareSheetButtonTitle: String {
        NostrailRecipientActionFormatter.shareSheetButtonTitle(
            isSharing: isSharing,
            containsSendRetry: hasShareSendRetryFailures,
            containsLookupCheck: hasShareLookupFailures,
            allRecipientsCurrent: allShareRecipientsCurrent
        )
    }

    private var shareSheetButtonIcon: String {
        isSharing ? "location.circle" : "location.circle.fill"
    }

    private var retryableRecipients: [String] {
        recipientRowState.inviteRetryRecipients(from: recipients)
    }

    private var allVisibleInvitesSent: Bool {
        !recipients.isEmpty && retryableRecipients.isEmpty && recipientRowState.purpose == .invite
    }

    private var hasSheetSendRetryFailures: Bool {
        recipients.contains { recipientRowState.needingRetry.contains($0) }
    }

    private var hasInviteSendRetryFailures: Bool {
        guard recipientRowState.purpose == .invite else { return false }
        return retryableRecipients.contains { recipientRowState.needingRetry.contains($0) }
    }

    private var hasInviteLookupFailures: Bool {
        guard recipientRowState.purpose == .invite else { return false }
        return retryableRecipients.contains { recipientRowState.needingAttention.contains($0) }
    }

    private var shareRetryRecipients: [String] {
        recipientRowState.shareRetryRecipients(from: recipients)
    }

    private var hasShareSendRetryFailures: Bool {
        guard recipientRowState.purpose == .shareRetry else { return false }
        return shareRetryRecipients.contains { recipientRowState.needingRetry.contains($0) }
    }

    private var hasShareLookupFailures: Bool {
        guard recipientRowState.purpose == .shareRetry else { return false }
        return shareRetryRecipients.contains { recipientRowState.needingAttention.contains($0) }
    }

    private var allShareRecipientsCurrent: Bool {
        isSharing &&
            !recipients.isEmpty &&
            recipientRowState.purpose == .shareRetry &&
            shareRetryRecipients.isEmpty
    }

    private var shouldShowSheetReconnectButton: Bool {
        isRetrySendBlockedByRelayPath || NostrailRelayStatusFormatter.shouldShowRecipientSheetReconnectButton(
            hasRetryableSendFailures: hasSheetSendRetryFailures,
            didReconnect: didRestoreRetryPath
        )
    }

    private var shouldPrioritizeInviteRetry: Bool {
        guard !isInviteRetryBlockedByRelayPath else { return false }
        return NostrailRecipientActionFormatter.shouldPrioritizeInviteRetry(
            containsSendRetry: hasInviteSendRetryFailures,
            didReconnect: didRestoreRetryPath
        )
    }

    private var didRestoreRetryPath: Bool {
        didReconnectFromSheet || didRecoverFromRelaySettings
    }

    private var isRetrySendBlockedByRelayPath: Bool {
        guard !didRecoverFromRelaySettings else { return false }
        return NostrailRelayStatusFormatter.shouldBlockRecipientSheetRetry(
            hasRetryableSendFailures: hasSheetSendRetryFailures,
            didReconnect: didReconnectFromSheet,
            relayCheckResults: sheetReconnectRelayCheckResults
        )
    }

    private var isInviteRetryBlockedByRelayPath: Bool {
        hasInviteSendRetryFailures && isRetrySendBlockedByRelayPath
    }

    private var isShareRetryBlockedByRelayPath: Bool {
        hasShareSendRetryFailures && isRetrySendBlockedByRelayPath
    }

    private var isActiveSharingBlockedByRelayPath: Bool {
        SwiftrootsConnectionStatusFormatter.isActiveSharingSheetActionDisabled(
            isSharing: isSharing,
            activeSharingRelayWarningText: activeSharingRelayWarningText
        )
    }

    private var activeSharingSheetWarningText: String {
        SwiftrootsConnectionStatusFormatter.activeSharingSheetWarningText(
            isSharing: isSharing,
            activeSharingRelayWarningText: activeSharingRelayWarningText
        )
    }

    private var isBusy: Bool {
        isSending || isReconnecting
    }

    private var isSheetReconnectDisabled: Bool {
        isBusy || !relayReconnectRetryWaitText.isEmpty
    }

    private var relayReconnectRetryWaitText: String {
        RelayReconnectCooldown.waitText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sheetReconnectRelayCheckResults
        )
    }

    private var relayReconnectRetryStatusText: String {
        RelayReconnectCooldown.retryStatusText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sheetReconnectRelayCheckResults,
            readyText: "Reconnect now."
        )
    }

    private func recipientRowDetailText(for status: RecipientRowDisplayStatus) -> String? {
        status.detailText(didReconnect: didRestoreRetryPath)
    }

    private func addRecipient() {
        guard !isBusy else { return }
        addRecipient(newRecipient)
    }

    private func pasteAndAddRecipient() {
        guard !isBusy else { return }
        guard let clipboardText = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !clipboardText.isEmpty else {
            statusLine = "Clipboard is empty."
            return
        }
        addRecipient(clipboardText)
    }

    private func addRecipient(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let result = RecipientBatchInputNormalizer.normalizeMany(trimmed, existingRecipients: recipients)
        recipients.append(contentsOf: result.added.map(\.displayText))
        if result.hasFeedback {
            notice = ""
        }

        if result.invalidInputs.isEmpty {
            newRecipient = ""
            focusedField = nil
        } else {
            newRecipient = result.invalidInputs.joined(separator: ", ")
            focusedField = .recipient
        }

        statusLine = NostrailRecipientBatchStatusFormatter.statusText(for: result)
    }

    private func removeRecipients(at offsets: IndexSet) {
        guard !isBusy else { return }
        let removedCount = offsets.count
        recipients.remove(atOffsets: offsets)
        recipientRowState.prune(to: recipients)
        if recipientRowState.needingRetry.isEmpty {
            didReconnectFromSheet = false
            sheetReconnectRelayCheckResults = []
            didRecoverFromRelaySettings = false
        }
        if recipientRowState.needingAttention.isEmpty, recipientRowState.needingRetry.isEmpty {
            notice = ""
        }
        statusLine = removedCount == 1 ? "Recipient removed." : "\(removedCount) recipients removed."
    }

    private func editRecipient(_ recipient: String) {
        guard !isBusy,
              let index = recipients.firstIndex(of: recipient) else { return }
        recipients.remove(at: index)
        recipientRowState.prune(to: recipients)
        if recipientRowState.needingRetry.isEmpty {
            didReconnectFromSheet = false
            sheetReconnectRelayCheckResults = []
            didRecoverFromRelaySettings = false
        }
        if recipientRowState.needingAttention.isEmpty, recipientRowState.needingRetry.isEmpty {
            notice = ""
        }
        newRecipient = recipient
        focusedField = .recipient
        statusLine = "Edit the recipient, then add it again."
    }

    private func sendInvites() {
        guard !isBusy else { return }
        isSending = true
        Task {
            let attemptedRecipients = retryableRecipients
            statusLine = NostrailRecipientActionFormatter.inviteSendStatus(
                containsSendRetry: hasInviteSendRetryFailures
            )
            do {
                let result = try await onSendInvites(attemptedRecipients)
                statusLine = result.message
                recipientRowState.markPublishResult(
                    attemptedRecipients: attemptedRecipients,
                    failedLookupInputs: result.failedLookupInputs,
                    failedSendInputs: result.failedSendInputs,
                    purpose: .invite
                )
                notice = NostrailRecipientFeedbackFormatter.combinedFailureText(
                    lookupInputs: result.failedLookupInputs,
                    sendInputs: result.failedSendInputs
                )
                didReconnectFromSheet = false
                didRecoverFromRelaySettings = false
                isSending = false
                if result.shouldDismiss {
                    dismiss()
                } else {
                    focusedField = .recipient
                }
            } catch {
                if isRecipientResolutionFailure(error) {
                    recipientRowState.markPublishResult(
                        attemptedRecipients: attemptedRecipients,
                        failedInputs: attemptedRecipients,
                        purpose: .invite
                    )
                    notice = NostrailRecipientFeedbackFormatter.failureSummaryText(
                        lookupInputs: attemptedRecipients,
                        sendInputs: []
                    )
                    statusLine = "No invites sent. \(notice)"
                    focusedField = .recipient
                } else {
                    didReconnectFromSheet = false
                    didRecoverFromRelaySettings = false
                    recipientRowState.markPublishResult(
                        attemptedRecipients: attemptedRecipients,
                        failedLookupInputs: [],
                        failedSendInputs: attemptedRecipients,
                        purpose: .invite
                    )
                    notice = NostrailRecipientFeedbackFormatter.failureSummaryText(
                        lookupInputs: [],
                        sendInputs: attemptedRecipients
                    )
                    statusLine = "No invites sent. \(notice)"
                }
                isSending = false
            }
        }
    }

    private func reconnectFromSheet() {
        guard !isSheetReconnectDisabled else { return }
        focusedField = nil
        nextRelayReconnectAllowedAt = nil
        isReconnecting = true
        statusLine = NostrailRelayStatusFormatter.recipientSheetReconnectStatus(isRunning: true)
        Task {
            do {
                let relayCheckResults = try await onReconnectRelays()
                nextRelayReconnectAllowedAt = nil
                relayReconnectFailureCount = 0
                didReconnectFromSheet = true
                sheetReconnectRelayCheckResults = relayCheckResults
                statusLine = NostrailRelayStatusFormatter.recipientSheetReconnectStatus(
                    isRunning: false,
                    relayCheckResults: relayCheckResults
                )
            } catch {
                startRelayReconnectRetryCooldown()
                statusLine = nostrailUserFacingMessage(for: error, relayContext: .connect)
            }
            isReconnecting = false
        }
    }

    private func startRelayReconnectRetryCooldown(relayCheckResults: [RelayConnectionCheckResult] = []) {
        relayReconnectFailureCount += 1
        let failureCount = RelayReconnectCooldown.effectiveFailureCount(
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: relayCheckResults
        )
        let delay = RelayReconnectCooldown.delay(afterConsecutiveFailures: failureCount)
        let nextAllowedAt = RelayReconnectCooldown.nextAllowedAt(delay: delay)
        self.nextRelayReconnectAllowedAt = nextAllowedAt
        Task {
            try? await Task.sleep(for: .seconds(delay))
            guard self.nextRelayReconnectAllowedAt == nextAllowedAt else { return }
            self.nextRelayReconnectAllowedAt = nil
        }
    }

    private func clearCorrectableStatus() {
        if NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(statusLine) {
            statusLine = ""
            notice = ""
        }
    }

}

private struct NostrailPendingRelayChange {
    let url: URL
    let readEnabled: Bool
    let writeEnabled: Bool
    let impact: RelayStateChangeImpact
}

private struct NostrailRelaySettingsSheet: View {
    @ObservedObject var sharingService: LocationSharingService
    let isResolvingStopSharingRetry: Bool
    let onReconnectRelays: () async throws -> [RelayConnectionCheckResult]
    let onRelayStateChanged: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var statusLine = ""
    @State private var isReconnecting = false
    @State private var nextRelayReconnectAllowedAt: Date?
    @State private var relayReconnectFailureCount = 0
    @State private var didChangeRelaySettings = false
    @State private var newRelayURL = ""
    @State private var pendingRelayChange: NostrailPendingRelayChange?
    @State private var isRelayChangeConfirmationPresented = false
    @State private var pendingRelayRemovalURL: URL?
    @State private var isRelayRemovalConfirmationPresented = false
    @State private var isRestoreDefaultRelaysConfirmationPresented = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Connection") {
                    Text(sharingService.relayAvailabilityText)
                    if !lastRelayCheckText.isEmpty {
                        Text(lastRelayCheckText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if didChangeRelaySettings {
                        Label(relaySettingsChangedStatusText, systemImage: "exclamationmark.arrow.triangle.2.circlepath")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    Button {
                        reconnectRelays()
                    } label: {
                        Label(
                            NostrailRelayStatusFormatter.reconnectButtonTitle(
                                isRunning: isReconnecting,
                                retryWaitText: relayReconnectRetryWaitText
                            ),
                            systemImage: "antenna.radiowaves.left.and.right"
                        )
                    }
                    .disabled(isReconnectButtonDisabled)
                    let reconnectHelperText = NostrailRelayStatusFormatter.reconnectHelperText(
                        serviceStatusText: sharingService.statusText,
                        retryWaitText: relayReconnectRetryStatusText
                    )
                    if !reconnectHelperText.isEmpty {
                        Text(reconnectHelperText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Relays") {
                    HStack {
                        TextField("wss://relay.example", text: $newRelayURL)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.URL)
                            .autocorrectionDisabled()
                            .disabled(isReconnecting)
                            .onSubmit(addRelay)
                        Button {
                            addRelay()
                        } label: {
                            Label("Add Relay", systemImage: "plus.circle")
                        }
                        .disabled(isReconnecting || newRelayURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    Button {
                        isRestoreDefaultRelaysConfirmationPresented = true
                    } label: {
                        Label("Restore Default Relays", systemImage: "arrow.counterclockwise")
                    }
                    .disabled(isReconnecting)
                    if sharingService.relayEndpoints.isEmpty {
                        Text(sharingService.relayAvailabilityText)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(sharingService.relayEndpoints, id: \.url) { endpoint in
                            let currentEndpoint = currentRelayEndpoint(for: endpoint)
                            NostrailRelaySettingsRow(
                                endpoint: currentEndpoint,
                                connectionCheck: relayConnectionCheck(for: endpoint),
                                helperText: relaySettingsRowHelperText(for: currentEndpoint),
                                receiveBinding: relayReceiveBinding(for: endpoint),
                                shareBinding: relayShareBinding(for: endpoint),
                                canRemove: !RelayEndpointInput.isBuiltInRelay(currentEndpoint.url)
                            ) {
                                requestRemoveRelay(currentEndpoint.url)
                            }
                        }
                    }
                }

                if !statusLine.isEmpty {
                    Section("Status") {
                        Text(statusLine)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Relay Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .disabled(isReconnecting)
                }
            }
            .confirmationDialog(
                pendingRelayChange?.impact.title ?? "Change relay setting?",
                isPresented: $isRelayChangeConfirmationPresented,
                titleVisibility: .visible
            ) {
                if let pendingRelayChange {
                    Button(pendingRelayChange.impact.actionTitle, role: .destructive) {
                        confirmPendingRelayChange()
                    }
                }
                Button("Cancel", role: .cancel) {
                    pendingRelayChange = nil
                }
            } message: {
                Text(pendingRelayChange?.impact.message ?? "")
            }
            .confirmationDialog(
                "Remove this custom relay?",
                isPresented: $isRelayRemovalConfirmationPresented,
                titleVisibility: .visible
            ) {
                if let pendingRelayRemovalURL {
                    Button("Remove Relay", role: .destructive) {
                        removeRelay(pendingRelayRemovalURL)
                    }
                }
                Button("Cancel", role: .cancel) {
                    pendingRelayRemovalURL = nil
                }
            } message: {
                Text("This removes \(pendingRelayRemovalURL?.host() ?? "the relay") from Settings. You can add it again later.")
            }
            .confirmationDialog(
                "Restore default relays?",
                isPresented: $isRestoreDefaultRelaysConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Restore Defaults", role: .destructive) {
                    restoreDefaultRelays()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes custom relays and turns the built-in relays back on for Receive and Share.")
            }
        }
        .interactiveDismissDisabled(isReconnecting)
    }

    private var canReconnectRelays: Bool {
        SwiftrootsConnectionStatusFormatter.canCheckRelays(
            relayAvailabilityText: sharingService.relayAvailabilityText
        )
    }

    private var isReconnectButtonDisabled: Bool {
        isReconnecting ||
            !canReconnectRelays ||
            !relayReconnectRetryWaitText.isEmpty
    }

    private var relayReconnectRetryWaitText: String {
        RelayReconnectCooldown.waitText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults
        )
    }

    private var relayReconnectRetryStatusText: String {
        RelayReconnectCooldown.retryStatusText(
            now: Date(),
            nextAllowedAt: nextRelayReconnectAllowedAt,
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults,
            readyText: "Reconnect now."
        )
    }

    private var lastRelayCheckText: String {
        SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
            summary: sharingService.lastRelayCheckSummary,
            checkedAt: sharingService.lastRelayCheckDate,
            now: Date()
        )
    }

    private var relaySettingsChangedStatusText: String {
        NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
            relayAvailabilityText: sharingService.relayAvailabilityText,
            isResolvingStopSharingRetry: isResolvingStopSharingRetry
        )
    }

    private func currentRelayEndpoint(for endpoint: NRConstants.RelayEndpoint) -> NRConstants.RelayEndpoint {
        sharingService.relayEndpoints.first(where: { $0.url == endpoint.url }) ?? endpoint
    }

    private func relayConnectionCheck(for endpoint: NRConstants.RelayEndpoint) -> RelayConnectionCheckResult? {
        sharingService.relayConnectionCheckResults.first(where: { $0.url == endpoint.url })
    }

    private func relaySettingsRowHelperText(for endpoint: NRConstants.RelayEndpoint) -> String {
        NostrailRelayStatusFormatter.relaySettingsRowHelperText(
            endpoint: endpoint,
            relayAvailabilityText: sharingService.relayAvailabilityText,
            connectionCheck: relayConnectionCheck(for: endpoint)
        )
    }

    private func relayReceiveBinding(for endpoint: NRConstants.RelayEndpoint) -> Binding<Bool> {
        Binding(
            get: {
                currentRelayEndpoint(for: endpoint).readEnabled
            },
            set: { isEnabled in
                let current = currentRelayEndpoint(for: endpoint)
                requestRelayStateChange(
                    for: endpoint.url,
                    readEnabled: isEnabled,
                    writeEnabled: current.writeEnabled
                )
            }
        )
    }

    private func relayShareBinding(for endpoint: NRConstants.RelayEndpoint) -> Binding<Bool> {
        Binding(
            get: {
                currentRelayEndpoint(for: endpoint).writeEnabled
            },
            set: { isEnabled in
                let current = currentRelayEndpoint(for: endpoint)
                requestRelayStateChange(
                    for: endpoint.url,
                    readEnabled: current.readEnabled,
                    writeEnabled: isEnabled
                )
            }
        )
    }

    private func requestRelayStateChange(for url: URL, readEnabled: Bool, writeEnabled: Bool) {
        if let impact = RelayStateChangeGuard.impact(
            ofChanging: url,
            toReadEnabled: readEnabled,
            writeEnabled: writeEnabled,
            in: sharingService.relayEndpoints
        ) {
            pendingRelayChange = NostrailPendingRelayChange(
                url: url,
                readEnabled: readEnabled,
                writeEnabled: writeEnabled,
                impact: impact
            )
            isRelayChangeConfirmationPresented = true
            return
        }

        applyRelayStateChange(for: url, readEnabled: readEnabled, writeEnabled: writeEnabled)
    }

    private func confirmPendingRelayChange() {
        guard let pendingRelayChange else { return }
        applyRelayStateChange(
            for: pendingRelayChange.url,
            readEnabled: pendingRelayChange.readEnabled,
            writeEnabled: pendingRelayChange.writeEnabled
        )
        self.pendingRelayChange = nil
    }

    private func applyRelayStateChange(for url: URL, readEnabled: Bool, writeEnabled: Bool) {
        sharingService.setRelayState(for: url, readEnabled: readEnabled, writeEnabled: writeEnabled)
        nextRelayReconnectAllowedAt = nil
        relayReconnectFailureCount = 0
        didChangeRelaySettings = true
        statusLine = relaySettingsChangedStatusText
        onRelayStateChanged(sharingService.relayAvailabilityText)
    }

    private func addRelay() {
        do {
            let url = try sharingService.addRelay(urlString: newRelayURL)
            newRelayURL = ""
            nextRelayReconnectAllowedAt = nil
            relayReconnectFailureCount = 0
            didChangeRelaySettings = true
            statusLine = NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added \(url.host() ?? url.absoluteString).",
                relayAvailabilityText: sharingService.relayAvailabilityText,
                isResolvingStopSharingRetry: isResolvingStopSharingRetry
            )
            onRelayStateChanged(sharingService.relayAvailabilityText)
        } catch {
            statusLine = RelaySettingsActionFailureFormatter.statusText(error: error, action: .addRelay)
        }
    }

    private func requestRemoveRelay(_ url: URL) {
        pendingRelayRemovalURL = url
        isRelayRemovalConfirmationPresented = true
    }

    private func removeRelay(_ url: URL) {
        do {
            try sharingService.removeRelay(url: url)
            pendingRelayRemovalURL = nil
            nextRelayReconnectAllowedAt = nil
            relayReconnectFailureCount = 0
            didChangeRelaySettings = true
            statusLine = NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Removed \(url.host() ?? url.absoluteString).",
                relayAvailabilityText: sharingService.relayAvailabilityText,
                isResolvingStopSharingRetry: isResolvingStopSharingRetry
            )
            onRelayStateChanged(sharingService.relayAvailabilityText)
        } catch {
            pendingRelayRemovalURL = nil
            statusLine = RelaySettingsActionFailureFormatter.statusText(error: error, action: .removeRelay)
        }
    }

    private func restoreDefaultRelays() {
        do {
            try sharingService.restoreDefaultRelays()
            newRelayURL = ""
            nextRelayReconnectAllowedAt = nil
            relayReconnectFailureCount = 0
            didChangeRelaySettings = true
            statusLine = NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Default relays restored.",
                relayAvailabilityText: sharingService.relayAvailabilityText,
                isResolvingStopSharingRetry: isResolvingStopSharingRetry
            )
            onRelayStateChanged(sharingService.relayAvailabilityText)
        } catch {
            statusLine = RelaySettingsActionFailureFormatter.statusText(error: error, action: .restoreDefaults)
        }
    }

    private func reconnectRelays() {
        guard !isReconnectButtonDisabled else { return }
        let previousServiceStatusText = sharingService.statusText
        nextRelayReconnectAllowedAt = nil
        isReconnecting = true
        statusLine = "Reconnecting..."
        Task {
            defer { isReconnecting = false }
            do {
                let relayCheckResults = try await onReconnectRelays()
                nextRelayReconnectAllowedAt = nil
                relayReconnectFailureCount = 0
                statusLine = NostrailRelayStatusFormatter.reconnectSuccessText(
                    previousServiceStatusText: previousServiceStatusText,
                    relayCheckResults: relayCheckResults
                )
                didChangeRelaySettings = false
            } catch {
                startRelayReconnectRetryCooldown(relayCheckResults: sharingService.relayConnectionCheckResults)
                let errorMessage = nostrailUserFacingMessage(
                    for: error,
                    serviceStatusText: sharingService.statusText,
                    relayContext: .connect
                )
                statusLine = NostrailRelayStatusFormatter.reconnectFailureText(
                    previousServiceStatusText: previousServiceStatusText,
                    errorMessage: errorMessage
                )
            }
        }
    }

    private func startRelayReconnectRetryCooldown(relayCheckResults: [RelayConnectionCheckResult] = []) {
        relayReconnectFailureCount += 1
        let failureCount = RelayReconnectCooldown.effectiveFailureCount(
            actionFailureCount: relayReconnectFailureCount,
            relayCheckResults: relayCheckResults
        )
        let delay = RelayReconnectCooldown.delay(afterConsecutiveFailures: failureCount)
        let nextAllowedAt = RelayReconnectCooldown.nextAllowedAt(delay: delay)
        self.nextRelayReconnectAllowedAt = nextAllowedAt
        Task {
            try? await Task.sleep(for: .seconds(delay))
            guard self.nextRelayReconnectAllowedAt == nextAllowedAt else { return }
            self.nextRelayReconnectAllowedAt = nil
        }
    }
}

private struct NostrailRelaySettingsRow: View {
    let endpoint: NRConstants.RelayEndpoint
    let connectionCheck: RelayConnectionCheckResult?
    let helperText: String
    let receiveBinding: Binding<Bool>
    let shareBinding: Binding<Bool>
    let canRemove: Bool
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(relayName)
            Text(endpoint.url.absoluteString)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .textSelection(.enabled)
            Text(RelayEndpointAvailability(endpoint: endpoint).userFacingDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
            if let connectionCheck {
                Text("Last reachability check: \(connectionCheck.userFacingDescription)")
                    .font(.caption)
                    .foregroundColor(connectionCheck.diagnosticDescription == nil ? .secondary : .red)
            }
            if !helperText.isEmpty {
                Label(helperText, systemImage: helperIcon)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            Toggle("Receive", isOn: receiveBinding)
            Toggle("Share", isOn: shareBinding)
            if canRemove {
                Button(role: .destructive) {
                    onRemove()
                } label: {
                    Label("Remove Relay", systemImage: "trash")
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var relayName: String {
        endpoint.url.host() ?? endpoint.url.absoluteString
    }

    private var helperIcon: String {
        connectionCheck?.recoveryDescription == helperText ? "exclamationmark.triangle" : "paperplane"
    }
}
