import Foundation
import SwiftUI

struct NIP07PermissionPrompt: Identifiable {
    let id = UUID()
    let origin: String
    let host: String
    let method: String
    let allow: (_ remember: Bool) -> Void
    let deny: () -> Void
}

@MainActor
final class BrowserAppModel: ObservableObject {
    @Published private(set) var hasKey = false
    @Published var currentURLString = NRConstants.nostrootsURL.absoluteString
    @Published var keyImportText = ""
    @Published var errorMessage: String?
    @Published var webViewReloadID = UUID()
    @Published var nip07PermissionPrompt: NIP07PermissionPrompt?
    @Published var pendingNotificationPlusCode: String?

    let keyStore: KeyStore
    let cryptoProvider: NostrCryptoProviding
    let nip07PermissionStore: NIP07PermissionStoring
    let pushNotifications: VibePushNotificationManager

    init(
        keyStore: KeyStore = KeychainKeyStore(),
        cryptoProvider: NostrCryptoProviding = CryptoProviderFactory.makeDefaultProvider(),
        nip07PermissionStore: NIP07PermissionStoring = NIP07PermissionStore(),
        pushNotifications: VibePushNotificationManager = .shared
    ) {
        self.keyStore = keyStore
        self.cryptoProvider = cryptoProvider
        self.nip07PermissionStore = nip07PermissionStore
        self.pushNotifications = pushNotifications
        self.pushNotifications.configure(keyStore: keyStore, cryptoProvider: cryptoProvider)
        refreshKeyStatus()
    }

    var npub: String? {
        guard let pubkey = keyStore.currentPublicKeyHex() else { return nil }
        return try? NIP19.encodeNpub(pubkeyHex: pubkey)
    }

    var nsec: String? {
        guard let secret = keyStore.currentSecretHex() else { return nil }
        return try? NIP19.encodeNsec(secretHex: secret)
    }

    var mnemonic: String? {
        keyStore.currentMnemonic()
    }

    var nip07PermissionEntries: [NIP07PermissionEntry] {
        nip07PermissionStore.entries(policy: NIP07PermissionPolicy())
    }

    func refreshKeyStatus() {
        hasKey = keyStore.currentSecretHex() != nil
    }

    func importKey() {
        do {
            try keyStore.importSecret(keyImportText)
            nip07PermissionStore.clear()
            keyImportText = ""
            errorMessage = nil
            refreshKeyStatus()
            reloadWebView()
        } catch {
            errorMessage = KeyImportParser.userFacingMessage(for: keyImportText, error: error)
        }
    }

    func generateKey() {
        do {
            let secret = try NIP19.generateSecretHex()
            try keyStore.importGeneratedSecret(secret)
            nip07PermissionStore.clear()
            errorMessage = nil
            refreshKeyStatus()
            reloadWebView()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeKey() {
        do {
            try keyStore.clearSecret()
            nip07PermissionStore.clear()
            refreshKeyStatus()
            reloadWebView()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadAddressBarURL() {
        guard let url = normalizedURL(from: currentURLString) else {
            errorMessage = "Enter a web address."
            return
        }
        loadURL(url)
    }

    func loadURL(_ url: URL) {
        currentURLString = url.absoluteString
        reloadWebView()
    }

    func resetToNostroots() {
        currentURLString = NRConstants.nostrootsURL.absoluteString
        reloadWebView()
    }

    func reloadWebView() {
        webViewReloadID = UUID()
    }

    func requestNIP07Permission(_ prompt: NIP07PermissionPrompt) {
        nip07PermissionPrompt = prompt
    }

    func handleNotificationTap(plusCode: String) {
        let normalized = plusCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !normalized.isEmpty else { return }
        pendingNotificationPlusCode = normalized
    }

    func revokeNIP07Permission(origin: String) {
        nip07PermissionStore.revoke(origin: origin)
        objectWillChange.send()
    }

    private func normalizedURL(from raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }
        return URL(string: "https://\(trimmed)")
    }
}
