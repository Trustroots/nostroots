import SwiftUI
import UIKit

struct NativeKeyOnboardingView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case generate = "Generate"
        case importExisting = "Import"

        var id: String { rawValue }
    }

    enum FocusedField {
        case importKey
        case backup
        case username
    }

    let appName: String
    let subtitle: String
    let requiresTrustrootsLink: Bool
    @ObservedObject var sharingService: LocationSharingService
    @Binding var trustrootsUsername: String
    var recoveryNotice: String = ""
    var onRecoveryNoticeCleared: () -> Void = {}
    var onTrustrootsLinked: (String, String) -> Void = { _, _ in }
    var onTrustrootsCleared: () -> Void = {}

    @State private var selectedMode: Mode = .generate
    @State private var importInput = ""
    @State private var generatedSecretHex: String?
    @State private var generatedNsec = ""
    @State private var backupConfirmation = ""
    @State private var statusLine = ""
    @State private var usernameInput = ""
    @State private var isVerifyingUsername = false
    @State private var isStopSharingRunning = false
    @State private var hasPendingStopSharingRetry = false
    @State private var isUseDifferentKeyConfirmationPresented = false
    @FocusState private var focusedField: FocusedField?

    private var backupMatches: Bool {
        NativeKeyBackupConfirmation.matches(confirmation: backupConfirmation, generatedNsec: generatedNsec)
    }

    private var shouldShowTrustrootsLink: Bool {
        requiresTrustrootsLink && sharingService.hasImportedKey && trimmedTrustrootsUsername.isEmpty
    }

    private var trimmedTrustrootsUsername: String {
        trustrootsUsername.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header

                    if !recoveryNotice.isEmpty {
                        Label(recoveryNotice, systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
                    }

                    if shouldShowTrustrootsLink {
                        trustrootsLinkSection
                    } else {
                        keySetupSection
                    }

                    if !statusLine.isEmpty {
                        Text(statusLine)
                            .font(.footnote)
                            .foregroundStyle(NativeOnboardingStatusFormatter.isErrorStatus(statusLine) ? .red : .secondary)
                            .accessibilityIdentifier("onboarding-status")
                    }
                }
                .padding(24)
                .frame(maxWidth: 640, alignment: .leading)
            }
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: 8)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(sharingService.hasImportedKey ? "Finish Setup" : "Set Up Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        focusedField = nil
                    }
                }
            }
            .confirmationDialog(
                "Use a different key?",
                isPresented: $isUseDifferentKeyConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Clear Key", role: .destructive) {
                    clearOnboardingKey()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(NativeOnboardingKeyLifecycleMessage.useDifferentKeyConfirmation(requiresTrustrootsLink: requiresTrustrootsLink))
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 44, weight: .regular))
                .foregroundStyle(.tint)
            Text("Welcome to \(appName)")
                .font(.largeTitle.bold())
            Text(subtitle)
                .foregroundStyle(.secondary)
            Text("Start by connecting a key. Your secret key stays on this device and is never stored on our server.")
                .foregroundStyle(.secondary)
        }
    }

    private var keySetupSection: some View {
        VStack(alignment: .leading, spacing: 18) {
            if sharingService.hasImportedKey {
                Label(sharingService.keyStorageStatus.userFacingDescription, systemImage: "checkmark.seal")
                    .foregroundStyle(.secondary)
                if requiresTrustrootsLink {
                    Button {
                        statusLine = "Add your Trustroots username to finish setup."
                    } label: {
                        Label("Continue", systemImage: "arrow.right")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                Text("Your Key Is Your Identity")
                    .font(.title2.bold())
                Text("With Nostr keys, your identity can move across apps. Lose the key, lose the identity. Share the key, share your power.")
                    .foregroundStyle(.secondary)

                Picker("Key setup", selection: $selectedMode) {
                    ForEach(Mode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: selectedMode) { _, newMode in
                    handleSetupModeChange(to: newMode)
                }

                if selectedMode == .generate {
                    generateSection
                } else {
                    importSection
                }
            }
        }
    }

    private var generateSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Generate a new key")
                .font(.headline)
            Text("Create a new Nostr key, save the nsec in your password manager, then paste it back once to confirm your backup.")
                .foregroundStyle(.secondary)

            if generatedNsec.isEmpty {
                Button {
                    focusedField = nil
                    generateKey()
                } label: {
                    Label("Generate New Key", systemImage: "key")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your nsec")
                        .font(.subheadline.bold())
                    Text(generatedNsec)
                        .font(.system(.footnote, design: .monospaced))
                        .textSelection(.enabled)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
                    Button {
                        focusedField = nil
                        UIPasteboard.general.string = generatedNsec
                        statusLine = "nsec copied."
                    } label: {
                        Label("Copy nsec", systemImage: "doc.on.doc")
                    }
                    .buttonStyle(.bordered)
                }

                Text("Anyone with this nsec can act as you. Never share it. If you lose it, this identity cannot be recovered.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                TextField("Paste nsec back to confirm backup", text: $backupConfirmation, axis: .vertical)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.system(.body, design: .monospaced))
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .backup)
                    .submitLabel(.done)
                    .onChange(of: backupConfirmation) { _, _ in
                        clearRecoveryNotice()
                        clearErrorStatus()
                    }

                HStack {
                    Button {
                        focusedField = nil
                        saveGeneratedKey()
                    } label: {
                        Label("Save Key", systemImage: "checkmark.seal")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!backupMatches)

                    Button("Start Over") {
                        focusedField = nil
                        generatedSecretHex = nil
                        generatedNsec = ""
                        backupConfirmation = ""
                        statusLine = ""
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private var importSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Import an existing key")
                .font(.headline)
            Text("Paste your secret key. npub is your public address and is safe to share; nsec or your recovery phrase is secret.")
                .foregroundStyle(.secondary)

            TextField("nsec1..., recovery phrase, or private-key hex", text: $importInput, axis: .vertical)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(.body, design: .monospaced))
                .lineLimit(3...7)
                .textFieldStyle(.roundedBorder)
                .focused($focusedField, equals: .importKey)
                .submitLabel(.done)
                .onChange(of: importInput) { _, _ in
                    clearRecoveryNotice()
                    clearErrorStatus()
                }

            Button {
                focusedField = nil
                pasteAndImportKeyFromClipboard()
            } label: {
                Label("Paste and Import", systemImage: "doc.on.clipboard")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            Button {
                focusedField = nil
                importKey(importInput)
            } label: {
                Label("Import Key", systemImage: "square.and.arrow.down")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(importInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private var trustrootsLinkSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Connect to Trustroots")
                .font(.title2.bold())
            Text("Enter your Trustroots username or profile link. Swiftroots checks that your username points to this public key using NIP-05.")
                .foregroundStyle(.secondary)
            if let publicKey = sharingService.publicKeyHex,
               let npub = try? NIP19.encodeNpub(pubkeyHex: publicKey) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(npub)
                        .font(.system(.footnote, design: .monospaced))
                        .lineLimit(1)
                        .textSelection(.enabled)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))

                    HStack {
                        Button {
                            focusedField = nil
                            UIPasteboard.general.string = npub
                            statusLine = "npub copied. Add it to your Trustroots Networks page."
                        } label: {
                            Label("Copy npub", systemImage: "doc.on.doc")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button {
                            focusedField = nil
                            statusLine = "Opening Trustroots Networks..."
                            openTrustrootsNetworks()
                        } label: {
                            Label("Open Trustroots", systemImage: "arrow.up.forward.app")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            TextField("alice, alice@trustroots.org, or profile link", text: $usernameInput)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
                .focused($focusedField, equals: .username)
                .submitLabel(.done)
                .onChange(of: usernameInput) { _, _ in
                    guard !isVerifyingUsername else { return }
                    clearRecoveryNotice()
                    clearErrorStatus()
                }
                .onSubmit {
                    guard !isVerifyingUsername,
                          !usernameInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        return
                    }
                    focusedField = nil
                    verifyTrustrootsUsername()
                }
            Button {
                focusedField = nil
                pasteAndVerifyTrustrootsUsernameFromClipboard()
            } label: {
                Label("Paste and Verify", systemImage: "doc.on.clipboard")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(isVerifyingUsername)

            Button {
                focusedField = nil
                verifyTrustrootsUsername()
            } label: {
                Label(isVerifyingUsername ? "Checking..." : "Verify Username", systemImage: "checkmark.seal")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isVerifyingUsername || usernameInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button {
                focusedField = nil
                isUseDifferentKeyConfirmationPresented = true
            } label: {
                Label("Use a Different Key", systemImage: "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(isVerifyingUsername || isKeyChangeBlocked)

            if sharingService.isSharing {
                Button {
                    focusedField = nil
                    stopSharing()
                } label: {
                    Label(onboardingStopSharingButtonTitle, systemImage: "stop.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isStopSharingRunning)

                Text(onboardingStopSharingHelperText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear {
            if usernameInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                usernameInput = trimmedTrustrootsUsername
            }
        }
    }

    private func generateKey() {
        do {
            clearRecoveryNotice()
            let secret = try NIP19.generateSecretHex()
            generatedSecretHex = secret
            generatedNsec = try NIP19.encodeNsec(secretHex: secret)
            backupConfirmation = ""
            statusLine = "New key generated. Back it up before continuing."
        } catch {
            statusLine = NativeOnboardingKeyLifecycleMessage.generatedKeyFailure(error: error)
        }
    }

    private func saveGeneratedKey() {
        do {
            guard let generatedSecretHex else { return }
            guard backupMatches else {
                statusLine = "That does not match the generated nsec."
                return
            }
            clearRecoveryNotice()
            try sharingService.importKey(generatedSecretHex)
            clearGeneratedKeyDraft()
            statusLine = NativeOnboardingKeyLifecycleMessage.generatedKeySaved(storageStatus: sharingService.keyStorageStatus)
        } catch {
            let message = KeyImportParser.userFacingMessage(for: generatedNsec, error: error)
            statusLine = NativeOnboardingKeyLifecycleMessage.keySaveFailure(
                error: error,
                fallbackMessage: message,
                retryAction: .saveGeneratedKey,
                requiresTrustrootsLink: requiresTrustrootsLink
            )
        }
    }

    private func clearGeneratedKeyDraft() {
        generatedSecretHex = nil
        generatedNsec = ""
        backupConfirmation = ""
    }

    private func handleSetupModeChange(to mode: Mode) {
        focusedField = nil
        clearRecoveryNotice()
        statusLine = ""
        switch mode {
        case .generate:
            importInput = ""
        case .importExisting:
            clearGeneratedKeyDraft()
        }
    }

    private func importKey(_ raw: String) {
        do {
            clearRecoveryNotice()
            let result = try sharingService.importKey(raw)
            importInput = ""
            statusLine = importedKeyStatus(for: result.source)
        } catch {
            importInput = raw
            let message = KeyImportParser.userFacingMessage(for: raw, error: error)
            statusLine = NativeOnboardingKeyLifecycleMessage.keySaveFailure(
                error: error,
                fallbackMessage: message,
                retryAction: .importKey,
                requiresTrustrootsLink: requiresTrustrootsLink
            )
        }
    }

    private func pasteAndImportKeyFromClipboard() {
        clearRecoveryNotice()
        guard let clipboardText = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !clipboardText.isEmpty else {
            statusLine = "Clipboard is empty."
            return
        }
        importInput = clipboardText
        importKey(clipboardText)
    }

    private func importedKeyStatus(for source: KeyImportSource) -> String {
        switch source {
        case .mnemonic:
            return "Recovery phrase imported. \(sharingService.keyStorageStatus.userFacingDescription)"
        case .nsec:
            return "nsec imported. \(sharingService.keyStorageStatus.userFacingDescription)"
        case .hex:
            return "Private key imported. \(sharingService.keyStorageStatus.userFacingDescription)"
        }
    }

    private func verifyTrustrootsUsername() {
        clearRecoveryNotice()
        guard let publicKey = sharingService.publicKeyHex else {
            statusLine = "No key is available on this device."
            return
        }
        let username: String
        let handle: String
        do {
            username = try TrustrootsUsername.normalize(usernameInput)
            handle = try TrustrootsUsername.nip05(username)
        } catch {
            statusLine = error.localizedDescription
            return
        }
        isVerifyingUsername = true
        statusLine = "Checking \(handle)..."
        Task {
            do {
                let resolved = try await Nip05Resolver().resolve(handle)
                await MainActor.run {
                    isVerifyingUsername = false
                    if resolved == publicKey {
                        trustrootsUsername = username
                        usernameInput = username
                        onTrustrootsLinked(username, publicKey)
                        statusLine = SwiftrootsLinkingMessageFormatter.linked
                    } else {
                        statusLine = SwiftrootsLinkingMessageFormatter.differentKey
                    }
                }
            } catch {
                await MainActor.run {
                    isVerifyingUsername = false
                    statusLine = SwiftrootsLinkingMessageFormatter.verificationFailure(handle: handle, error: error)
                }
            }
        }
    }

    private func pasteAndVerifyTrustrootsUsernameFromClipboard() {
        clearRecoveryNotice()
        guard let clipboardText = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !clipboardText.isEmpty else {
            statusLine = "Clipboard is empty."
            return
        }
        usernameInput = clipboardText
        verifyTrustrootsUsername()
    }

    private func clearOnboardingKey() {
        do {
            clearRecoveryNotice()
            try sharingService.clearKey()
            trustrootsUsername = ""
            onTrustrootsCleared()
            usernameInput = ""
            generatedSecretHex = nil
            generatedNsec = ""
            backupConfirmation = ""
            statusLine = NativeOnboardingKeyLifecycleMessage.clearKeySuccess(
                storageStatus: sharingService.keyStorageStatus
            )
        } catch {
            statusLine = NativeOnboardingKeyLifecycleMessage.clearKeyFailure(
                error: error,
                requiresTrustrootsLink: requiresTrustrootsLink
            )
        }
    }

    private var isKeyChangeBlocked: Bool {
        sharingService.isSharing || isStopSharingRunning
    }

    private var onboardingStopSharingButtonTitle: String {
        NativeOnboardingStopSharingFormatter.buttonTitle(
            isStopping: isStopSharingRunning,
            requiresTrustrootsLink: requiresTrustrootsLink,
            isSharing: sharingService.isSharing,
            sessionExpiresAtUnix: sharingService.sessionExpiresAtUnix,
            serviceStatusText: sharingService.statusText,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private var onboardingStopSharingHelperText: String {
        NativeOnboardingStopSharingFormatter.helperText(
            requiresTrustrootsLink: requiresTrustrootsLink,
            buttonTitle: onboardingStopSharingButtonTitle,
            serviceStatusText: sharingService.statusText,
            hasPendingRetry: hasPendingStopSharingRetry
        )
    }

    private func stopSharing() {
        guard sharingService.isSharing, !isStopSharingRunning else { return }
        isStopSharingRunning = true
        statusLine = "Stopping sharing..."
        Task {
            do {
                try await sharingService.stopSession()
                hasPendingStopSharingRetry = false
                statusLine = "Sharing stopped. You can use a different key now."
            } catch {
                hasPendingStopSharingRetry = sharingService.isSharing
                statusLine = NativeOnboardingKeyLifecycleMessage.stopSharingFailure(
                    userFacingMessage: RelayUserFacingMessageFormatter.message(for: error, context: .stop),
                    requiresTrustrootsLink: requiresTrustrootsLink,
                    isSharingStillActive: hasPendingStopSharingRetry
                )
            }
            isStopSharingRunning = false
        }
    }

    private func openTrustrootsNetworks() {
        guard let url = URL(string: "https://www.trustroots.org/profile/edit/networks") else { return }
        UIApplication.shared.open(url)
    }

    private func clearErrorStatus() {
        if NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(statusLine) {
            statusLine = ""
        }
    }

    private func clearRecoveryNotice() {
        if !recoveryNotice.isEmpty {
            onRecoveryNoticeCleared()
        }
    }
}
