import CoreLocation
import SwiftUI
import UIKit

struct SwiftrootsRootView: View {
    private enum DefaultsKey {
        static let trustrootsUsername = "swiftroots.trustrootsUsername"
        static let linkedPublicKeyHex = "swiftroots.linkedPublicKeyHex"
    }

    @ObservedObject var sharingService: LocationSharingService
    @State private var trustrootsUsername = SwiftrootsOnboardingDefaults.normalized(UserDefaults.standard.string(forKey: DefaultsKey.trustrootsUsername))
    @State private var linkedPublicKeyHex = SwiftrootsOnboardingDefaults.normalized(UserDefaults.standard.string(forKey: DefaultsKey.linkedPublicKeyHex))
    @State private var onboardingRecoveryNotice = ""

    private var isOnboarded: Bool {
        SwiftrootsOnboardingGate.isOnboarded(
            hasImportedKey: sharingService.hasImportedKey,
            publicKeyHex: sharingService.publicKeyHex,
            trustrootsUsername: trustrootsUsername,
            linkedPublicKeyHex: linkedPublicKeyHex
        )
    }

    var body: some View {
        Group {
            if isOnboarded {
                SwiftrootsMainTabs(
                    sharingService: sharingService,
                    trustrootsUsername: $trustrootsUsername,
                    linkedPublicKeyHex: $linkedPublicKeyHex,
                    onClearKeySuccess: { message in
                        onboardingRecoveryNotice = message
                    }
                )
            } else {
                NativeKeyOnboardingView(
                    appName: "Swiftroots",
                    subtitle: "Swiftroots rebuilds Trustroots on open protocols so travelers and hosts keep control of identity and connections.",
                    requiresTrustrootsLink: true,
                    sharingService: sharingService,
                    trustrootsUsername: $trustrootsUsername,
                    recoveryNotice: onboardingRecoveryNotice,
                    onRecoveryNoticeCleared: {
                        onboardingRecoveryNotice = ""
                    },
                    onTrustrootsLinked: { _, publicKeyHex in
                        linkedPublicKeyHex = publicKeyHex
                        onboardingRecoveryNotice = ""
                    },
                    onTrustrootsCleared: {
                        linkedPublicKeyHex = ""
                        onboardingRecoveryNotice = ""
                    }
                )
            }
        }
        .onAppear(perform: clearStaleTrustrootsLinkIfNeeded)
        .onChange(of: trustrootsUsername) { _, value in
            SwiftrootsOnboardingDefaults.persist(value, forKey: DefaultsKey.trustrootsUsername)
        }
        .onChange(of: linkedPublicKeyHex) { _, value in
            SwiftrootsOnboardingDefaults.persist(value, forKey: DefaultsKey.linkedPublicKeyHex)
        }
        .onChange(of: sharingService.publicKeyHex) { _, _ in
            clearStaleTrustrootsLinkIfNeeded()
        }
    }

    private func clearStaleTrustrootsLinkIfNeeded() {
        guard let message = SwiftrootsOnboardingRecoveryMessage.staleLinkReset(
            hasImportedKey: sharingService.hasImportedKey,
            publicKeyHex: sharingService.publicKeyHex,
            trustrootsUsername: trustrootsUsername,
            linkedPublicKeyHex: linkedPublicKeyHex,
            existingNotice: onboardingRecoveryNotice
        ) else {
            return
        }
        onboardingRecoveryNotice = message
        trustrootsUsername = ""
        linkedPublicKeyHex = ""
    }
}

private struct SwiftrootsMainTabs: View {
    private struct PendingRelayChange {
        let url: URL
        let readEnabled: Bool
        let writeEnabled: Bool
        let impact: RelayStateChangeImpact
    }

    private enum StatusScope: Hashable {
        case home
        case profile
        case chat
        case settings
    }

    @ObservedObject var sharingService: LocationSharingService
    @StateObject private var locationProvider = DeviceLocationProvider()
    @Binding var trustrootsUsername: String
    @Binding var linkedPublicKeyHex: String
    var onClearKeySuccess: (String) -> Void = { _ in }
    @State private var selectedTab: StatusScope = .home
    @State private var statusLine = ""
    @State private var statusScope: StatusScope?
    @State private var isClearKeyConfirmationPresented = false
    @State private var isConnectionCheckRunning = false
    @State private var isStopSharingRunning = false
    @State private var isStartSharingSheetPresented = false
    @State private var isStartSharingRunning = false
    @State private var isWaitingForStartLocation = false
    @State private var startSharingSheetStatus = ""
    @State private var startSharingSheetNotice = ""
    @State private var didCompleteStartSharingSheetCurrentAreaUpdate = false
    @State private var startSharingRecipients: [String] = []
    @State private var startSharingRecipientRowState = RecipientRowState()
    @State private var didRecoverStartSharingRelaysFromSettings = false
    @State private var shouldReturnToStartSharingSheetAfterRelaySettings = false
    @State private var currentCoordinate: CLLocationCoordinate2D?
    @State private var pendingRelayChange: PendingRelayChange?
    @State private var isRelayChangeConfirmationPresented = false
    @State private var nextRelayCheckAllowedAt: Date?
    @State private var relayCheckFailureCount = 0
    @State private var didChangeRelaySettings = false
    @State private var hasPendingStopSharingRetry = false
    @State private var newRelayURL = ""
    @State private var pendingRelayRemovalURL: URL?
    @State private var isRelayRemovalConfirmationPresented = false
    @State private var isRestoreDefaultRelaysConfirmationPresented = false

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                List {
                    Section("Identity") {
                        SwiftrootsIdentityValueRow(title: "Trustroots handle", value: trustrootsHandle)
                        if let publicAddress {
                            SwiftrootsIdentityValueRow(title: "Public address", value: publicAddress, isMonospaced: true)
                            Button {
                                copyPublicAddress(publicAddress, scope: .home)
                            } label: {
                                Label("Copy Public Address", systemImage: "doc.on.doc")
                            }
                        }
                        Button {
                            copyTrustrootsHandle(scope: .home)
                        } label: {
                            Label("Copy Trustroots Handle", systemImage: "doc.on.doc")
                        }
                        Button {
                            openTrustrootsProfile(scope: .home)
                        } label: {
                            Label("Open Trustroots Profile", systemImage: "arrow.up.forward.app")
                        }
                    }
                    Section("Connection") {
                        SwiftrootsConnectionStatusBlock(
                            connectionStatus: connectionStatus,
                            relayAvailabilityText: sharingService.relayAvailabilityText,
                            lastRelayCheckText: lastRelayCheckText,
                            didChangeRelaySettings: didChangeRelaySettings,
                            relaySettingsChangedStatusText: relaySettingsChangedStatusText,
                            relayCheckButtonTitle: relayCheckButtonTitle,
                            isRelayCheckDisabled: isRelayCheckDisabled,
                            relayCheckHelperText: relayCheckHelperText
                        ) {
                            checkConnection(scope: .home)
                        }
                    }
                    Section("Sharing") {
                        SwiftrootsSharingStatusBlock(
                            sharingStatus: sharingStatus,
                            sessionDetailText: sessionDetailText,
                            sessionDetailIcon: sessionDetailIcon,
                            sessionDetailIsWarning: sessionDetailIsWarning,
                            activeSharingRecipientsText: activeSharingRecipientsText,
                            receivedLocationsText: receivedLocationsText,
                            activeSharingRelayWarningText: activeSharingRelayWarningText,
                            sharingReadinessText: sharingReadinessText,
                            sharingReadinessIcon: sharingReadinessIcon,
                            sharingReadinessIsWarning: sharingReadinessIsWarning,
                            isSharing: sharingService.isSharing,
                            startSharingButtonTitle: startSharingButtonTitle,
                            stopSharingButtonTitle: stopSharingButtonTitle,
                            isStopSharingDisabled: isStopSharingRunning,
                            stopSharingHelperText: stopSharingRecoveryHelperText,
                            onPrepareSharing: {
                                prepareSharing(scope: .home)
                            },
                            onStopSharing: {
                                stopSharing(scope: .home)
                            }
                        )
                    }
                    if shouldShowStatus(in: .home) {
                        Section("Status") {
                            Text(statusLine)
                                .font(.caption)
                                .foregroundStyle(isErrorStatus(statusLine) ? .red : .secondary)
                        }
                    }
                }
                .navigationTitle("Swiftroots")
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(StatusScope.home)

            NavigationStack {
                List {
                    Section("Trustroots Profile") {
                        SwiftrootsIdentityValueRow(title: "Trustroots handle", value: trustrootsHandle)
                        if let publicAddress {
                            SwiftrootsIdentityValueRow(title: "Public address", value: publicAddress, isMonospaced: true)
                            Button {
                                copyPublicAddress(publicAddress, scope: .profile)
                            } label: {
                                Label("Copy Public Address", systemImage: "doc.on.doc")
                            }
                        }
                        Button {
                            copyTrustrootsHandle(scope: .profile)
                        } label: {
                            Label("Copy Trustroots Handle", systemImage: "doc.on.doc")
                        }
                        Button {
                            openTrustrootsProfile(scope: .profile)
                        } label: {
                            Label("Open Trustroots Profile", systemImage: "arrow.up.forward.app")
                        }
                    }
                    Section("Swiftroots Profile") {
                        Label("Ready for Swiftroots profile", systemImage: "checkmark.seal")
                        Text("Profile editing, contacts, and claims will use your verified Trustroots identity.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if shouldShowStatus(in: .profile) {
                        Section("Status") {
                            Text(statusLine)
                                .font(.caption)
                                .foregroundStyle(isErrorStatus(statusLine) ? .red : .secondary)
                        }
                    }
                }
                .navigationTitle("Profile")
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
            .tag(StatusScope.profile)

            NavigationStack {
                List {
                    Section("Messages") {
                        Label("Chat is coming next", systemImage: "message")
                        Text("Direct messages and circle conversations will use your verified Trustroots identity.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Section("Messaging Identity") {
                        SwiftrootsIdentityValueRow(title: "Trustroots handle", value: trustrootsHandle)
                        Button {
                            copyTrustrootsHandle(scope: .chat)
                        } label: {
                            Label("Copy Trustroots Handle", systemImage: "doc.on.doc")
                        }
                    }
                    if shouldShowStatus(in: .chat) {
                        Section("Status") {
                            Text(statusLine)
                                .font(.caption)
                                .foregroundStyle(isErrorStatus(statusLine) ? .red : .secondary)
                        }
                    }
                }
                .navigationTitle("Chat")
            }
            .tabItem { Label("Chat", systemImage: "message") }
            .tag(StatusScope.chat)

            NavigationStack {
                List {
                    Section("Identity") {
                        SwiftrootsIdentityValueRow(title: "Trustroots handle", value: trustrootsHandle)
                        Button {
                            copyTrustrootsHandle(scope: .settings)
                        } label: {
                            Label("Copy Trustroots Handle", systemImage: "doc.on.doc")
                        }
                        Button {
                            openTrustrootsProfile(scope: .settings)
                        } label: {
                            Label("Open Trustroots Profile", systemImage: "arrow.up.forward.app")
                        }
                    }
                    Section("Connection") {
                        SwiftrootsConnectionStatusBlock(
                            connectionStatus: connectionStatus,
                            relayAvailabilityText: sharingService.relayAvailabilityText,
                            lastRelayCheckText: lastRelayCheckText,
                            didChangeRelaySettings: didChangeRelaySettings,
                            relaySettingsChangedStatusText: relaySettingsChangedStatusText,
                            relayCheckButtonTitle: relayCheckButtonTitle,
                            isRelayCheckDisabled: isRelayCheckDisabled,
                            relayCheckHelperText: relayCheckHelperText
                        ) {
                            checkConnection(scope: .settings)
                        }
                    }
                    Section("Relays") {
                        if !sharingReadinessText.isEmpty {
                            Label(sharingReadinessText, systemImage: sharingReadinessIcon)
                                .font(.caption)
                                .foregroundStyle(sharingReadinessIsWarning ? .orange : .secondary)
                        }
                        if shouldHighlightStartSharingRetryRelayRows {
                            Label(startSharingRelaySettingsRecoveryText, systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                        HStack {
                            TextField("wss://relay.example", text: $newRelayURL)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .disabled(isConnectionCheckRunning)
                                .onSubmit(addRelay)
                            Button {
                                addRelay()
                            } label: {
                                Label("Add Relay", systemImage: "plus.circle")
                            }
                            .disabled(isConnectionCheckRunning || newRelayURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                        Button {
                            isRestoreDefaultRelaysConfirmationPresented = true
                        } label: {
                            Label("Restore Default Relays", systemImage: "arrow.counterclockwise")
                        }
                        .disabled(isConnectionCheckRunning)
                        if sharingService.relayEndpoints.isEmpty {
                            Text(sharingService.relayAvailabilityText)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(sharingService.relayEndpoints, id: \.url) { endpoint in
                                SwiftrootsRelaySettingsRow(
                                    endpoint: currentRelayEndpoint(for: endpoint),
                                    connectionCheck: relayConnectionCheck(for: endpoint),
                                    helperText: relaySettingsRowHelperText(for: endpoint),
                                    receiveBinding: relayReceiveBinding(for: endpoint),
                                    shareBinding: relayShareBinding(for: endpoint),
                                    canRemove: !RelayEndpointInput.isBuiltInRelay(currentRelayEndpoint(for: endpoint).url)
                                ) {
                                    requestRemoveRelay(currentRelayEndpoint(for: endpoint).url)
                                }
                            }
                        }
                    }
                    Section("Key") {
                        Label(sharingService.keyStorageStatus.userFacingDescription, systemImage: "checkmark.seal")
                            .foregroundStyle(.secondary)
                        if let publicAddress {
                            SwiftrootsIdentityValueRow(title: "Public address", value: publicAddress, isMonospaced: true)
                            Button {
                                copyPublicAddress(publicAddress, scope: .settings)
                            } label: {
                                Label("Copy Public Address", systemImage: "doc.on.doc")
                            }
                        }
                        Button("Clear Key", role: .destructive) {
                            isClearKeyConfirmationPresented = true
                        }
                        .disabled(isKeyChangeBlocked)
                        SwiftrootsSharingStatusBlock(
                            sharingStatus: sharingStatus,
                            sessionDetailText: sessionDetailText,
                            sessionDetailIcon: sessionDetailIcon,
                            sessionDetailIsWarning: sessionDetailIsWarning,
                            activeSharingRecipientsText: activeSharingRecipientsText,
                            receivedLocationsText: receivedLocationsText,
                            activeSharingRelayWarningText: activeSharingRelayWarningText,
                            sharingReadinessText: sharingReadinessText,
                            sharingReadinessIcon: sharingReadinessIcon,
                            sharingReadinessIsWarning: sharingReadinessIsWarning,
                            isSharing: sharingService.isSharing,
                            startSharingButtonTitle: startSharingButtonTitle,
                            stopSharingButtonTitle: stopSharingButtonTitle,
                            isStopSharingDisabled: isStopSharingRunning,
                            stopSharingHelperText: settingsStopSharingHelperText,
                            onPrepareSharing: {
                                prepareSharing(scope: .settings)
                            },
                            onStopSharing: {
                                stopSharing(scope: .settings)
                            }
                        )
                    }
                    if shouldShowStatus(in: .settings) {
                        Section("Status") {
                            Text(statusLine)
                                .font(.caption)
                                .foregroundStyle(isErrorStatus(statusLine) ? .red : .secondary)
                        }
                    }
                }
                .navigationTitle("Settings")
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
            .tag(StatusScope.settings)
        }
        .sheet(isPresented: $isStartSharingSheetPresented) {
            SwiftrootsStartSharingSheet(
                recipients: $startSharingRecipients,
                notice: $startSharingSheetNotice,
                statusLine: $startSharingSheetStatus,
                recipientRowState: $startSharingRecipientRowState,
                didRecoverFromRelaySettings: $didRecoverStartSharingRelaysFromSettings,
                didCompleteCurrentAreaUpdate: $didCompleteStartSharingSheetCurrentAreaUpdate,
                isStarting: isStartSharingRunning,
                isFindingLocation: isWaitingForStartLocation || locationProvider.isRequestingLocation,
                hasLocationFix: currentCoordinate != nil,
                isSharing: sharingService.isSharing,
                activeSessionRecipients: sharingService.activeSessionRecipientDisplayValues,
                activeSharingRelayWarningText: activeSharingRelayWarningText,
                shouldShowLocationSettingsButton: shouldShowStartSharingSheetLocationSettings,
                shouldRetryLocation: shouldRetryStartSharingSheetLocation,
                onStartSharing: startSharingFromSheet,
                onReconnectRelays: reconnectRelaysFromStartSharingSheet,
                onOpenRelaySettings: openRelaySettingsFromStartSharingSheet,
                onOpenLocationSettings: openAppSettings,
                onCancelLocationWait: cancelStartSharingLocationWait
            )
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
            Text(SwiftrootsKeyLifecycleMessage.clearKeyConfirmation)
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
        .onReceive(locationProvider.$coordinate.compactMap { $0 }) { coordinate in
            currentCoordinate = coordinate
            sharingService.updateCurrentLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            let shouldResumeStartSharing = isWaitingForStartLocation
            isWaitingForStartLocation = false
            guard shouldResumeStartSharing else {
                if SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                    startSharingSheetStatus
                ) {
                    startSharingSheetStatus = SwiftrootsConnectionStatusFormatter.startSharingCurrentAreaReadyText()
                }
                return
            }
            startSharingFromSheet()
        }
        .onChange(of: locationProvider.statusText) { _, text in
            guard !text.isEmpty else { return }
            isWaitingForStartLocation = false
            didCompleteStartSharingSheetCurrentAreaUpdate = false
            startSharingSheetStatus = text
        }
    }

    private var connectionStatus: String {
        SwiftrootsConnectionStatusFormatter.statusText(
            isAuthenticated: sharingService.isAuthenticated,
            relayAvailabilityText: sharingService.relayAvailabilityText,
            serviceStatusText: sharingService.statusText
        )
    }

    private var trustrootsHandle: String {
        (try? TrustrootsUsername.nip05(trustrootsUsername)) ?? trustrootsUsername
    }

    private var publicAddress: String? {
        guard let pubkey = sharingService.publicKeyHex else { return nil }
        return try? NIP19.encodeNpub(pubkeyHex: pubkey)
    }

    private var sharingStatus: String {
        SwiftrootsConnectionStatusFormatter.sharingStatusText(
            isSharing: sharingService.isSharing,
            sessionExpiresAtUnix: sharingService.sessionExpiresAtUnix,
            now: Date()
        )
    }

    private var receivedLocationsText: String {
        SwiftrootsConnectionStatusFormatter.receivedLocationsText(
            count: sharingService.receivedLocations.count
        )
    }

    private var sharingReadinessText: String {
        SwiftrootsConnectionStatusFormatter.sharingReadinessText(
            isSharing: sharingService.isSharing,
            relayAvailabilityText: sharingService.relayAvailabilityText,
            lastRelayCheckSummary: sharingService.lastRelayCheckSummary,
            didChangeRelaySettings: didChangeRelaySettings,
            serviceStatusText: sharingService.statusText,
            lastRelayCheckDate: sharingService.lastRelayCheckDate
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

    private var sharingReadinessIsWarning: Bool {
        !sharingReadinessText.isEmpty && sharingReadinessText != "Relays checked for sharing."
    }

    private var sharingReadinessIcon: String {
        sharingReadinessIsWarning ? "exclamationmark.circle" : "checkmark.circle"
    }

    private var startSharingButtonTitle: String {
        SwiftrootsConnectionStatusFormatter.startSharingButtonTitle(
            isSharing: sharingService.isSharing,
            sharingReadinessText: sharingReadinessText
        )
    }

    private var sessionDetailText: String {
        SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
            isSharing: sharingService.isSharing,
            sessionExpiresAtUnix: sharingService.sessionExpiresAtUnix,
            now: Date()
        )
    }

    private var activeSharingRecipientsText: String {
        SwiftrootsConnectionStatusFormatter.activeSharingRecipientsText(
            isSharing: sharingService.isSharing,
            recipientDisplayValues: sharingService.activeSessionRecipientDisplayValues
        )
    }

    private var shouldShowStartSharingSheetLocationSettings: Bool {
        SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetLocationSettings(
            statusLine: startSharingSheetStatus
        )
    }

    private var shouldRetryStartSharingSheetLocation: Bool {
        SwiftrootsConnectionStatusFormatter.shouldRetryStartSharingSheetLocation(
            statusLine: startSharingSheetStatus,
            hasLocationFix: currentCoordinate != nil
        )
    }

    private var sessionDetailIsWarning: Bool {
        sharingStatus != "Sharing active" && sharingService.isSharing
    }

    private var sessionDetailIcon: String {
        sessionDetailIsWarning ? "exclamationmark.circle" : "timer"
    }

    private var stopSharingButtonTitle: String {
        SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
            isStopping: isStopSharingRunning,
            isSharing: sharingService.isSharing,
            sessionExpiresAtUnix: sharingService.sessionExpiresAtUnix,
            now: Date(),
            serviceStatusText: sharingService.statusText,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private var stopSharingRecoveryHelperText: String {
        SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
            serviceStatusText: sharingService.statusText,
            didChangeRelaySettings: didChangeRelaySettings,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private var settingsStopSharingHelperText: String {
        stopSharingRecoveryHelperText.isEmpty
            ? SwiftrootsKeyLifecycleMessage.stopSharingBeforeClear
            : stopSharingRecoveryHelperText
    }

    private var isKeyChangeBlocked: Bool {
        sharingService.isSharing || isStopSharingRunning
    }

    private var relayCheckButtonTitle: String {
        SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
            isChecking: isConnectionCheckRunning,
            relayAvailabilityText: sharingService.relayAvailabilityText,
            serviceStatusText: sharingService.statusText,
            retryWaitText: relayCheckRetryWaitText
        )
    }

    private var relayCheckHelperText: String {
        SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
            relayAvailabilityText: sharingService.relayAvailabilityText,
            serviceStatusText: sharingService.statusText,
            retryWaitText: relayCheckRetryStatusText
        )
    }

    private var isRelayCheckDisabled: Bool {
        isConnectionCheckRunning ||
            !relayCheckRetryWaitText.isEmpty ||
            !SwiftrootsConnectionStatusFormatter.canCheckRelays(
                relayAvailabilityText: sharingService.relayAvailabilityText
            )
    }

    private var relayCheckRetryWaitText: String {
        RelayReconnectCooldown.waitText(
            now: Date(),
            nextAllowedAt: nextRelayCheckAllowedAt,
            actionFailureCount: relayCheckFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults
        )
    }

    private var relayCheckRetryStatusText: String {
        RelayReconnectCooldown.retryStatusText(
            now: Date(),
            nextAllowedAt: nextRelayCheckAllowedAt,
            actionFailureCount: relayCheckFailureCount,
            relayCheckResults: sharingService.relayConnectionCheckResults,
            readyText: "Check relays now."
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
        SwiftrootsConnectionStatusFormatter.relaySettingsChangedStatusText(
            relayAvailabilityText: sharingService.relayAvailabilityText,
            isResolvingStopSharingRetry: hasPendingStopSharingRetry
        )
    }

    private func relaySettingsActionStatusText(actionText: String) -> String {
        SwiftrootsConnectionStatusFormatter.relaySettingsActionStatusText(
            actionText: actionText,
            relayAvailabilityText: sharingService.relayAvailabilityText,
            isResolvingSharingRetry: shouldReturnToStartSharingSheetAfterRelaySettings,
            isResolvingStopSharingRetry: hasPendingStopSharingRetry
        )
    }

    private func shouldShowStatus(in scope: StatusScope) -> Bool {
        !statusLine.isEmpty && statusScope == scope
    }

    private func currentRelayEndpoint(for endpoint: NRConstants.RelayEndpoint) -> NRConstants.RelayEndpoint {
        sharingService.relayEndpoints.first(where: { $0.url == endpoint.url }) ?? endpoint
    }

    private func relayConnectionCheck(for endpoint: NRConstants.RelayEndpoint) -> RelayConnectionCheckResult? {
        sharingService.relayConnectionCheckResults.first(where: { $0.url == endpoint.url })
    }

    private func relaySettingsRowHelperText(for endpoint: NRConstants.RelayEndpoint) -> String {
        SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
            endpoint: currentRelayEndpoint(for: endpoint),
            relayAvailabilityText: sharingService.relayAvailabilityText,
            connectionCheck: relayConnectionCheck(for: endpoint),
            isResolvingSharingRetry: shouldHighlightStartSharingRetryRelayRows
        )
    }

    private var shouldHighlightStartSharingRetryRelayRows: Bool {
        shouldReturnToStartSharingSheetAfterRelaySettings &&
            !startSharingRecipientRowState.needingRetry.isEmpty
    }

    private var startSharingRelaySettingsRecoveryText: String {
        SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
            relayAvailabilityText: sharingService.relayAvailabilityText
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
            pendingRelayChange = PendingRelayChange(
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
        didChangeRelaySettings = true
        nextRelayCheckAllowedAt = nil
        relayCheckFailureCount = 0
        updateStartSharingRelaySettingsRecoveryStatus()
        setStatus(relaySettingsChangedStatusText, scope: .settings)
    }

    private func addRelay() {
        do {
            let url = try sharingService.addRelay(urlString: newRelayURL)
            newRelayURL = ""
            didChangeRelaySettings = true
            nextRelayCheckAllowedAt = nil
            relayCheckFailureCount = 0
            updateStartSharingRelaySettingsRecoveryStatus()
            setStatus(
                relaySettingsActionStatusText(actionText: "Added \(url.host() ?? url.absoluteString)."),
                scope: .settings
            )
        } catch {
            setStatus(
                RelaySettingsActionFailureFormatter.statusText(error: error, action: .addRelay),
                scope: .settings
            )
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
            didChangeRelaySettings = true
            nextRelayCheckAllowedAt = nil
            relayCheckFailureCount = 0
            updateStartSharingRelaySettingsRecoveryStatus()
            setStatus(
                relaySettingsActionStatusText(actionText: "Removed \(url.host() ?? url.absoluteString)."),
                scope: .settings
            )
        } catch {
            pendingRelayRemovalURL = nil
            setStatus(
                RelaySettingsActionFailureFormatter.statusText(error: error, action: .removeRelay),
                scope: .settings
            )
        }
    }

    private func restoreDefaultRelays() {
        do {
            try sharingService.restoreDefaultRelays()
            newRelayURL = ""
            didChangeRelaySettings = true
            nextRelayCheckAllowedAt = nil
            relayCheckFailureCount = 0
            updateStartSharingRelaySettingsRecoveryStatus()
            setStatus(
                relaySettingsActionStatusText(actionText: "Default relays restored."),
                scope: .settings
            )
        } catch {
            setStatus(
                RelaySettingsActionFailureFormatter.statusText(error: error, action: .restoreDefaults),
                scope: .settings
            )
        }
    }

    private func openTrustrootsProfile(scope: StatusScope) {
        guard let username = try? TrustrootsUsername.normalize(trustrootsUsername),
              let url = URL(string: "https://www.trustroots.org/profile/\(username)") else {
            setStatus("Could not open Trustroots profile.", scope: scope)
            return
        }
        setStatus("Opening Trustroots profile...", scope: scope)
        UIApplication.shared.open(url)
    }

    private func copyTrustrootsHandle(scope: StatusScope) {
        UIPasteboard.general.string = trustrootsHandle
        setStatus("Trustroots handle copied.", scope: scope)
    }

    private func copyPublicAddress(_ publicAddress: String, scope: StatusScope) {
        UIPasteboard.general.string = publicAddress
        setStatus("Public address copied.", scope: scope)
    }

    private func checkConnection(scope: StatusScope) {
        guard !isRelayCheckDisabled else { return }
        let previousServiceStatusText = sharingService.statusText
        nextRelayCheckAllowedAt = nil
        isConnectionCheckRunning = true
        setStatus("Checking relays...", scope: scope)
        Task {
            defer { isConnectionCheckRunning = false }
            do {
                try await sharingService.authenticate()
                nextRelayCheckAllowedAt = nil
                relayCheckFailureCount = 0
                let resultText = SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                    results: sharingService.relayConnectionCheckResults,
                    fallback: "Relays ready.",
                    previousServiceStatusText: previousServiceStatusText
                )
                didChangeRelaySettings = false
                setStatus(resultText, scope: scope)
                returnToStartSharingSheetAfterRelayRecoveryIfNeeded(
                    relayCheckResults: sharingService.relayConnectionCheckResults
                )
            } catch {
                startRelayCheckRetryCooldown(relayCheckResults: sharingService.relayConnectionCheckResults)
                let fallback = RelayUserFacingMessageFormatter.message(for: error, context: .connect)
                let resultText = SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                    results: sharingService.relayConnectionCheckResults,
                    fallback: fallback,
                    previousServiceStatusText: previousServiceStatusText
                )
                didChangeRelaySettings = false
                updateStartSharingRelayCheckFailureStatus(
                    relayCheckResults: sharingService.relayConnectionCheckResults
                )
                setStatus(resultText, scope: scope)
            }
        }
    }

    private func startRelayCheckRetryCooldown(relayCheckResults: [RelayConnectionCheckResult] = []) {
        relayCheckFailureCount += 1
        let failureCount = RelayReconnectCooldown.effectiveFailureCount(
            actionFailureCount: relayCheckFailureCount,
            relayCheckResults: relayCheckResults
        )
        let delay = RelayReconnectCooldown.delay(afterConsecutiveFailures: failureCount)
        let nextAllowedAt = RelayReconnectCooldown.nextAllowedAt(delay: delay)
        self.nextRelayCheckAllowedAt = nextAllowedAt
        Task {
            try? await Task.sleep(for: .seconds(delay))
            guard self.nextRelayCheckAllowedAt == nextAllowedAt else { return }
            self.nextRelayCheckAllowedAt = nil
        }
    }

    private func clearKey() {
        do {
            try sharingService.clearKey()
            trustrootsUsername = ""
            linkedPublicKeyHex = ""
            isConnectionCheckRunning = false
            nextRelayCheckAllowedAt = nil
            relayCheckFailureCount = 0
            didChangeRelaySettings = false
            didRecoverStartSharingRelaysFromSettings = false
            shouldReturnToStartSharingSheetAfterRelaySettings = false
            isStartSharingSheetPresented = false
            startSharingRecipients = []
            startSharingRecipientRowState.clear()
            startSharingSheetNotice = ""
            startSharingSheetStatus = ""
            didCompleteStartSharingSheetCurrentAreaUpdate = false
            isWaitingForStartLocation = false
            hasPendingStopSharingRetry = false
            pendingRelayChange = nil
            pendingRelayRemovalURL = nil
            isRelayChangeConfirmationPresented = false
            isRelayRemovalConfirmationPresented = false
            isRestoreDefaultRelaysConfirmationPresented = false
            onClearKeySuccess(
                NativeOnboardingKeyLifecycleMessage.clearKeySuccess(
                    storageStatus: sharingService.keyStorageStatus
                )
            )
            setStatus("", scope: nil)
        } catch {
            setStatus(
                NativeOnboardingKeyLifecycleMessage.clearKeyFailure(
                    error: error,
                    requiresTrustrootsLink: true
                ),
                scope: .settings
            )
        }
    }

    private func stopSharing(scope: StatusScope) {
        guard sharingService.isSharing, !isStopSharingRunning else { return }
        isStopSharingRunning = true
        setStatus("Stopping sharing...", scope: scope)
        Task {
            do {
                try await sharingService.stopSession()
                startSharingRecipientRowState.clear()
                startSharingSheetNotice = ""
                didCompleteStartSharingSheetCurrentAreaUpdate = false
                didChangeRelaySettings = false
                hasPendingStopSharingRetry = false
                setStatus("Sharing stopped.", scope: scope)
            } catch {
                hasPendingStopSharingRetry = sharingService.isSharing
                let message = SwiftrootsKeyLifecycleMessage.stopSharingRecoveryMessage(
                    error: error,
                    serviceStatusText: sharingService.statusText,
                    userFacingMessage: RelayUserFacingMessageFormatter.message(for: error, context: .stop)
                )
                setStatus(message, scope: scope)
            }
            isStopSharingRunning = false
        }
    }

    private func prepareSharing(scope: StatusScope) {
        if sharingService.isSharing {
            seedStartSharingSheetFromActiveSession()
            startSharingSheetStatus = initialStartSharingSheetStatus()
            startSharingSheetNotice = ""
            didCompleteStartSharingSheetCurrentAreaUpdate = false
            isStartSharingSheetPresented = true
            return
        }
        guard sharingReadinessText == "Relays checked for sharing." else {
            setStatus(
                SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                    sharingReadinessText: sharingReadinessText
                ),
                scope: scope
            )
            return
        }

        startSharingSheetStatus = initialStartSharingSheetStatus()
        startSharingSheetNotice = ""
        didCompleteStartSharingSheetCurrentAreaUpdate = false
        isStartSharingSheetPresented = true
    }

    private func initialStartSharingSheetStatus() -> String {
        currentCoordinate == nil
            ? SwiftrootsConnectionStatusFormatter.startSharingInitialLocationPrompt()
            : ""
    }

    private func seedStartSharingSheetFromActiveSession() {
        startSharingRecipients = SwiftrootsConnectionStatusFormatter.startSharingSheetRecipients(
            currentRecipients: startSharingRecipients,
            activeSessionRecipientDisplayValues: sharingService.activeSessionRecipientDisplayValues,
            isSharing: sharingService.isSharing
        )
        startSharingRecipientRowState.prune(to: startSharingRecipients)
    }

    private func startSharingFromSheet() {
        guard !isStartSharingRunning else { return }
        guard sharingReadinessText == "Relays checked for sharing." || sharingService.isSharing else {
            startSharingSheetStatus = SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: sharingReadinessText
            )
            return
        }
        guard !startSharingRecipients.isEmpty else {
            startSharingSheetStatus = "Add at least one person before sharing."
            return
        }
        let didUpdateExistingShare = sharingService.isSharing
        guard let coordinate = currentCoordinate else {
            isWaitingForStartLocation = true
            didCompleteStartSharingSheetCurrentAreaUpdate = false
            startSharingSheetStatus = SwiftrootsConnectionStatusFormatter.startSharingWaitingForLocationText(
                didUpdateExistingShare: didUpdateExistingShare
            )
            locationProvider.requestCurrentLocation()
            return
        }

        let attemptedRecipients = startSharingRecipientRowState.shareRetryRecipients(from: startSharingRecipients)
        guard !attemptedRecipients.isEmpty else {
            startSharingSheetStatus = didUpdateExistingShare
                ? "Everyone selected already has the latest current-area update."
                : "Everyone selected already has the latest sharing start."
            return
        }

        isStartSharingRunning = true
        didCompleteStartSharingSheetCurrentAreaUpdate = false
        startSharingSheetStatus = didUpdateExistingShare ? "Sharing with added people..." : "Starting sharing..."
        Task {
            defer { isStartSharingRunning = false }
            do {
                sharingService.updateCurrentLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
                let result: SharePublishResult
                if didUpdateExistingShare {
                    result = try await sharingService.updateSharedLocationReportingFailures(
                        recipients: attemptedRecipients,
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude
                    )
                } else {
                    result = try await sharingService.startSessionReportingFailures(
                        recipients: attemptedRecipients,
                        initialLatitude: coordinate.latitude,
                        initialLongitude: coordinate.longitude
                    )
                }
                handleStartSharingResult(
                    result,
                    attemptedRecipients: attemptedRecipients,
                    didUpdateExistingShare: didUpdateExistingShare
                )
            } catch {
                handleStartSharingError(error, attemptedRecipients: attemptedRecipients)
            }
        }
    }

    private func cancelStartSharingLocationWait() {
        locationProvider.cancelCurrentLocationRequest()
        isWaitingForStartLocation = false
        didCompleteStartSharingSheetCurrentAreaUpdate = false
        startSharingSheetStatus = SwiftrootsConnectionStatusFormatter.startSharingLocationWaitCanceledText()
    }

    private func handleStartSharingResult(
        _ result: SharePublishResult,
        attemptedRecipients: [String],
        didUpdateExistingShare: Bool
    ) {
        startSharingRecipientRowState.markPublishResult(
            attemptedRecipients: attemptedRecipients,
            failedLookupInputs: result.failedLookupInputs,
            failedSendInputs: result.failedSendInputs,
            purpose: .shareRetry
        )

        let resultStatusText = SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
            sentCount: result.sentCount,
            failedLookupInputs: result.failedLookupInputs,
            failedSendInputs: result.failedSendInputs,
            didUpdateExistingShare: didUpdateExistingShare
        )

        guard result.hasFailures else {
            startSharingSheetNotice = ""
            startSharingSheetStatus = resultStatusText
            didCompleteStartSharingSheetCurrentAreaUpdate = didUpdateExistingShare
            setStatus(startSharingSheetStatus, scope: .home)
            isStartSharingSheetPresented = !SwiftrootsConnectionStatusFormatter.shouldDismissStartSharingSheetAfterResult(
                hasFailures: result.hasFailures,
                didUpdateExistingShare: didUpdateExistingShare
            )
            return
        }

        startSharingSheetNotice = NostrailRecipientFeedbackFormatter.failureSummaryText(
            lookupInputs: result.failedLookupInputs,
            sendInputs: result.failedSendInputs
        )
        startSharingSheetStatus = resultStatusText
        didCompleteStartSharingSheetCurrentAreaUpdate = false
        setStatus(startSharingSheetStatus, scope: .home)
    }

    private func handleStartSharingError(_ error: Error, attemptedRecipients: [String]) {
        if isRecipientResolutionFailure(error) {
            startSharingRecipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedInputs: attemptedRecipients,
                purpose: .shareRetry
            )
            startSharingSheetNotice = NostrailRecipientFeedbackFormatter.failureSummaryText(
                lookupInputs: attemptedRecipients,
                sendInputs: []
            )
            startSharingSheetStatus = "No location updates sent. \(startSharingSheetNotice)"
        } else {
            startSharingRecipientRowState.markPublishResult(
                attemptedRecipients: attemptedRecipients,
                failedLookupInputs: [],
                failedSendInputs: attemptedRecipients,
                purpose: .shareRetry
            )
            startSharingSheetNotice = NostrailRecipientFeedbackFormatter.failureSummaryText(
                lookupInputs: [],
                sendInputs: attemptedRecipients
            )
            startSharingSheetStatus = RelayUserFacingMessageFormatter.message(for: error, context: .publish)
        }
        didCompleteStartSharingSheetCurrentAreaUpdate = false
        setStatus(startSharingSheetStatus, scope: .home)
    }

    private func reconnectRelaysFromStartSharingSheet() async throws -> [RelayConnectionCheckResult] {
        try await sharingService.authenticate()
        didChangeRelaySettings = false
        didRecoverStartSharingRelaysFromSettings = false
        shouldReturnToStartSharingSheetAfterRelaySettings = false
        return sharingService.relayConnectionCheckResults
    }

    private func openRelaySettingsFromStartSharingSheet() {
        shouldReturnToStartSharingSheetAfterRelaySettings = true
        didRecoverStartSharingRelaysFromSettings = false
        isStartSharingSheetPresented = false
        selectedTab = .settings
        setStatus(SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryEntryText(), scope: .settings)
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func updateStartSharingRelaySettingsRecoveryStatus() {
        guard shouldReturnToStartSharingSheetAfterRelaySettings else { return }
        let relayAvailabilityText = sharingService.relayAvailabilityText
        didRecoverStartSharingRelaysFromSettings = false
        startSharingSheetNotice = SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
            relayAvailabilityText: relayAvailabilityText
        )
    }

    private func updateStartSharingRelayCheckFailureStatus(relayCheckResults: [RelayConnectionCheckResult]) {
        guard shouldReturnToStartSharingSheetAfterRelaySettings else { return }
        didRecoverStartSharingRelaysFromSettings = false
        startSharingSheetNotice = relayCheckResults.isEmpty
            ? "Could not check relays. Try Check Relays again before retrying Start Sharing."
            : SwiftrootsConnectionStatusFormatter.startSharingRelayCheckStatusText(
                relayAvailabilityText: sharingService.relayAvailabilityText,
                relayCheckResults: relayCheckResults
            )
    }

    private func returnToStartSharingSheetAfterRelayRecoveryIfNeeded(
        relayCheckResults: [RelayConnectionCheckResult]
    ) {
        guard shouldReturnToStartSharingSheetAfterRelaySettings else { return }
        let relayAvailabilityText = sharingService.relayAvailabilityText
        didRecoverStartSharingRelaysFromSettings =
            NostrailRelayStatusFormatter.didRelaySettingsRecoverSharingPath(relayAvailabilityText: relayAvailabilityText) &&
            !SwiftrootsConnectionStatusFormatter.isSharingPathUnavailable(results: relayCheckResults)
        startSharingSheetNotice = SwiftrootsConnectionStatusFormatter.startSharingRelayCheckStatusText(
            relayAvailabilityText: relayAvailabilityText,
            relayCheckResults: relayCheckResults
        )
        guard didRecoverStartSharingRelaysFromSettings,
              !startSharingRecipients.isEmpty,
              !startSharingRecipientRowState.needingRetry.isEmpty else {
            return
        }
        shouldReturnToStartSharingSheetAfterRelaySettings = false
        selectedTab = .home
        DispatchQueue.main.async {
            isStartSharingSheetPresented = true
        }
    }

    private func isRecipientResolutionFailure(_ error: Error) -> Bool {
        guard let serviceError = error as? LocationSharingServiceError else { return false }
        if case .recipientResolutionFailed = serviceError {
            return true
        }
        return false
    }

    private func setStatus(_ message: String, scope: StatusScope?) {
        statusLine = message
        statusScope = message.isEmpty ? nil : scope
    }

    private func isErrorStatus(_ text: String) -> Bool {
        ["Could not", "Stop sharing", "Finish stopping"].contains { text.hasPrefix($0) } ||
            text.contains("still active")
    }
}

private struct SwiftrootsIdentityValueRow: View {
    let title: String
    let value: String
    var isMonospaced = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(isMonospaced ? .system(.caption, design: .monospaced) : .body)
                .lineLimit(1)
                .truncationMode(isMonospaced ? .middle : .tail)
                .textSelection(.enabled)
        }
    }
}

private struct SwiftrootsConnectionStatusBlock: View {
    let connectionStatus: String
    let relayAvailabilityText: String
    let lastRelayCheckText: String
    let didChangeRelaySettings: Bool
    let relaySettingsChangedStatusText: String
    let relayCheckButtonTitle: String
    let isRelayCheckDisabled: Bool
    let relayCheckHelperText: String
    let onCheckRelays: () -> Void

    var body: some View {
        Text(connectionStatus)
        Text(relayAvailabilityText)
            .font(.caption)
            .foregroundStyle(.secondary)
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
            onCheckRelays()
        } label: {
            Label(relayCheckButtonTitle, systemImage: "antenna.radiowaves.left.and.right")
        }
        .disabled(isRelayCheckDisabled)
        if !relayCheckHelperText.isEmpty {
            Text(relayCheckHelperText)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

private struct SwiftrootsSharingStatusBlock: View {
    let sharingStatus: String
    let sessionDetailText: String
    let sessionDetailIcon: String
    let sessionDetailIsWarning: Bool
    let activeSharingRecipientsText: String
    let receivedLocationsText: String
    let activeSharingRelayWarningText: String
    let sharingReadinessText: String
    let sharingReadinessIcon: String
    let sharingReadinessIsWarning: Bool
    let isSharing: Bool
    let startSharingButtonTitle: String
    let stopSharingButtonTitle: String
    let isStopSharingDisabled: Bool
    let stopSharingHelperText: String
    let onPrepareSharing: () -> Void
    let onStopSharing: () -> Void

    var body: some View {
        Text(sharingStatus)
        if !sessionDetailText.isEmpty {
            Label(sessionDetailText, systemImage: sessionDetailIcon)
                .font(.caption)
                .foregroundStyle(sessionDetailIsWarning ? .orange : .secondary)
        }
        if !activeSharingRecipientsText.isEmpty {
            Label(activeSharingRecipientsText, systemImage: "person.2")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        Text(receivedLocationsText)
            .font(.caption)
            .foregroundStyle(.secondary)
        if !activeSharingRelayWarningText.isEmpty {
            Label(activeSharingRelayWarningText, systemImage: "exclamationmark.circle")
                .font(.caption)
                .foregroundStyle(.orange)
        }
        if !sharingReadinessText.isEmpty {
            Label(sharingReadinessText, systemImage: sharingReadinessIcon)
                .font(.caption)
                .foregroundStyle(sharingReadinessIsWarning ? .orange : .secondary)
        }
        if !startSharingButtonTitle.isEmpty, (!isSharing || sharingStatus == "Sharing active") {
            Button {
                onPrepareSharing()
            } label: {
                Label(startSharingButtonTitle, systemImage: "location.circle")
            }
        }
        if isSharing {
            Button {
                onStopSharing()
            } label: {
                Label(stopSharingButtonTitle, systemImage: "stop.circle")
            }
            .disabled(isStopSharingDisabled)
            if !stopSharingHelperText.isEmpty {
                Text(stopSharingHelperText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct SwiftrootsStartSharingSheet: View {
    private enum FocusedField {
        case recipient
    }

    @Binding var recipients: [String]
    @Binding var notice: String
    @Binding var statusLine: String
    @Binding var recipientRowState: RecipientRowState
    @Binding var didRecoverFromRelaySettings: Bool
    @Binding var didCompleteCurrentAreaUpdate: Bool
    let isStarting: Bool
    let isFindingLocation: Bool
    let hasLocationFix: Bool
    let isSharing: Bool
    let activeSessionRecipients: [String]
    let activeSharingRelayWarningText: String
    let shouldShowLocationSettingsButton: Bool
    let shouldRetryLocation: Bool
    let onStartSharing: () -> Void
    let onReconnectRelays: () async throws -> [RelayConnectionCheckResult]
    let onOpenRelaySettings: () -> Void
    let onOpenLocationSettings: () -> Void
    let onCancelLocationWait: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var newRecipient = ""
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

                Section("Add People") {
                    TextField("Trustroots username, profile link, NIP-05, npub, or pubkey", text: $newRecipient)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .recipient)
                        .submitLabel(.done)
                        .onSubmit(addRecipient)
                        .onChange(of: newRecipient) { _, _ in
                            clearCorrectableStatus()
                        }

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

                Section("People") {
                    if recipients.isEmpty {
                        Text(NostrailRecipientSummaryFormatter.recipientSheetEmptyText)
                            .foregroundStyle(.secondary)
                    } else {
                        if !sharingContextText.isEmpty {
                            Label(sharingContextText, systemImage: "person.2")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(recipients, id: \.self) { recipient in
                            let displayStatus = recipientRowState.displayStatus(for: recipient)
                            HStack(spacing: 10) {
                                if let imageName = displayStatus.systemImage,
                                   let accessibilityLabel = displayStatus.accessibilityLabel {
                                    Image(systemName: imageName)
                                        .foregroundStyle(statusColor(for: displayStatus))
                                        .frame(width: 20)
                                        .accessibilityLabel(accessibilityLabel)
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(NostrailRecipientSummaryFormatter.shortDisplayName(recipient))
                                        .font(.system(.body, design: .monospaced))
                                        .lineLimit(1)
                                        .truncationMode(.middle)
                                        .accessibilityLabel(recipient)
                                    if let detailText = displayStatus.detailText(didReconnect: didReconnectFromSheet) {
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

                Section("Location") {
                    if isFindingLocation {
                        Label("Finding your current approximate area...", systemImage: "location")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if hasLocationFix {
                        Label("Current approximate area ready.", systemImage: "checkmark.circle")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Swiftroots will ask iOS for your current approximate area before sharing.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
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
            .navigationTitle("Start Sharing")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom) {
                startActionBar
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

    private var startActionBar: some View {
        VStack(spacing: 8) {
            if isActiveSharingBlockedByRelayPath {
                Label(activeSharingSheetWarningText, systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }

            if shouldShowReconnectButton {
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

            if shouldShowLocationSettingsButton {
                Button {
                    onOpenLocationSettings()
                } label: {
                    Label("Open Settings", systemImage: "gearshape")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isBusy)
            }

            if isFindingLocation {
                Button {
                    onCancelLocationWait()
                } label: {
                    Label("Cancel Location Request", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isStarting || isReconnecting)
            }

            if shouldShowCompletionDoneButton {
                Button {
                    dismiss()
                } label: {
                    Label("Done", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            } else {
                Button {
                    focusedField = nil
                    onStartSharing()
                } label: {
                    Label(startButtonTitle, systemImage: startButtonIcon)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isStartButtonDisabled)
            }

            Text(bottomHelperText)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if isShareRetryBlockedByRelayPath || isActiveSharingBlockedByRelayPath {
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

    private var startButtonTitle: String {
        SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
            isStarting: isStarting,
            isFindingLocation: isFindingLocation,
            shouldRetryLocation: shouldRetryLocation,
            hasShareRetryFailures: hasShareRetryFailures,
            isSharing: isSharing
        )
    }

    private var startButtonIcon: String {
        SwiftrootsConnectionStatusFormatter.startSharingSheetButtonIcon(
            hasShareRetryFailures: hasShareRetryFailures
        )
    }

    private var bottomHelperText: String {
        if !relayReconnectRetryStatusText.isEmpty {
            return relayReconnectRetryStatusText
        }
        let completionText = SwiftrootsConnectionStatusFormatter.startSharingSheetCompletionHelperText(
            shouldShowDoneButton: shouldShowCompletionDoneButton
        )
        if !completionText.isEmpty {
            return completionText
        }
        let locationSettingsText = SwiftrootsConnectionStatusFormatter.startSharingSheetLocationSettingsHelperText(
            shouldShowLocationSettings: shouldShowLocationSettingsButton
        )
        if !locationSettingsText.isEmpty {
            return locationSettingsText
        }
        let locationRetryText = SwiftrootsConnectionStatusFormatter.startSharingSheetLocationRetryHelperText(
            shouldRetryLocation: shouldRetryLocation
        )
        if !locationRetryText.isEmpty {
            return locationRetryText
        }
        let locationWaitText = SwiftrootsConnectionStatusFormatter.startSharingSheetLocationWaitHelperText(
            isFindingLocation: isFindingLocation
        )
        if !locationWaitText.isEmpty {
            return locationWaitText
        }
        if isActiveSharingBlockedByRelayPath {
            return activeSharingSheetWarningText
        }
        return SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
            recipientCount: recipients.count,
            retryableRecipientCount: retryableRecipients.count,
            hasLocationFix: hasLocationFix,
            hasShareRetryFailures: hasShareRetryFailures,
            didReconnect: didRestoreRetryPath,
            isRetryBlockedByRelayPath: isShareRetryBlockedByRelayPath,
            isSharing: isSharing
        )
    }

    private var shouldShowCompletionDoneButton: Bool {
        SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
            isSharing: isSharing,
            isBusy: isBusy,
            didCompleteCurrentAreaUpdate: didCompleteCurrentAreaUpdate,
            hasShareRetryFailures: hasShareRetryFailures,
            retryableRecipientCount: retryableRecipients.count
        )
    }

    private var sharingContextText: String {
        SwiftrootsConnectionStatusFormatter.startSharingSheetContextText(
            visibleRecipients: recipients,
            activeSessionRecipientDisplayValues: activeSessionRecipients,
            isSharing: isSharing
        )
    }

    private var retryableRecipients: [String] {
        recipientRowState.shareRetryRecipients(from: recipients)
    }

    private var hasShareRetryFailures: Bool {
        guard recipientRowState.purpose == .shareRetry else { return false }
        return retryableRecipients.contains { recipientRowState.needingRetry.contains($0) }
    }

    private var shouldShowReconnectButton: Bool {
        SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetReconnect(
            hasShareRetryFailures: hasShareRetryFailures,
            didReconnect: didRestoreRetryPath,
            isRetryBlockedByRelayPath: isShareRetryBlockedByRelayPath
        )
    }

    private var isShareRetryBlockedByRelayPath: Bool {
        guard !didRecoverFromRelaySettings else { return false }
        return NostrailRelayStatusFormatter.shouldBlockRecipientSheetRetry(
            hasRetryableSendFailures: hasShareRetryFailures,
            didReconnect: didReconnectFromSheet,
            relayCheckResults: sheetReconnectRelayCheckResults
        )
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

    private var didRestoreRetryPath: Bool {
        didReconnectFromSheet || didRecoverFromRelaySettings
    }

    private var isBusy: Bool {
        isStarting || isFindingLocation || isReconnecting
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

    private var isStartButtonDisabled: Bool {
        isActiveSharingBlockedByRelayPath || SwiftrootsConnectionStatusFormatter.isStartSharingSheetStartDisabled(
            recipientCount: recipients.count,
            retryableRecipientCount: retryableRecipients.count,
            isBusy: isBusy,
            isRetryBlockedByRelayPath: isShareRetryBlockedByRelayPath
        )
    }

    private func statusColor(for displayStatus: RecipientRowDisplayStatus) -> Color {
        switch displayStatus {
        case .sent:
            return .green
        case .check, .retry:
            return .orange
        case .none:
            return .secondary
        }
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
        if result.hasChanges {
            didReconnectFromSheet = false
            sheetReconnectRelayCheckResults = []
            didRecoverFromRelaySettings = false
            didCompleteCurrentAreaUpdate = false
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
        didCompleteCurrentAreaUpdate = false
        recipientRowState.prune(to: recipients)
        if recipientRowState.needingRetry.isEmpty {
            didReconnectFromSheet = false
            sheetReconnectRelayCheckResults = []
            didRecoverFromRelaySettings = false
        }
        if recipientRowState.needingAttention.isEmpty, recipientRowState.needingRetry.isEmpty {
            notice = ""
        }
        statusLine = removedCount == 1 ? "Person removed." : "\(removedCount) people removed."
    }

    private func editRecipient(_ recipient: String) {
        guard !isBusy,
              let index = recipients.firstIndex(of: recipient) else { return }
        recipients.remove(at: index)
        didCompleteCurrentAreaUpdate = false
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

    private func clearCorrectableStatus() {
        guard !isBusy else { return }
        if didCompleteCurrentAreaUpdate {
            didCompleteCurrentAreaUpdate = false
        }
        if NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(statusLine) ||
            SwiftrootsConnectionStatusFormatter.shouldClearStartSharingLocationStatusWhileEditing(statusLine) {
            statusLine = ""
        }
        if NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(notice) {
            notice = ""
        }
    }

    private func reconnectFromSheet() {
        guard !isSheetReconnectDisabled else { return }
        nextRelayReconnectAllowedAt = nil
        isReconnecting = true
        statusLine = NostrailRelayStatusFormatter.recipientSheetReconnectStatus(isRunning: true)
        Task {
            do {
                let results = try await onReconnectRelays()
                nextRelayReconnectAllowedAt = nil
                relayReconnectFailureCount = 0
                sheetReconnectRelayCheckResults = results
                didReconnectFromSheet = true
                didRecoverFromRelaySettings = false
                notice = ""
                statusLine = NostrailRelayStatusFormatter.recipientSheetReconnectStatus(
                    isRunning: false,
                    relayCheckResults: results
                )
            } catch {
                startRelayReconnectRetryCooldown()
                didReconnectFromSheet = false
                sheetReconnectRelayCheckResults = []
                didRecoverFromRelaySettings = false
                statusLine = RelayUserFacingMessageFormatter.message(for: error, context: .connect)
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

}

private struct SwiftrootsRelaySettingsRow: View {
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
        connectionCheck?.recoveryDescription == helperText ? "exclamationmark.triangle" : "arrow.triangle.2.circlepath"
    }
}
