import CryptoKit
import Foundation
import Security

enum KeyStoreError: Error, LocalizedError {
    case missingSecret
    case invalidInput
    case pubkeyMismatch
    case signingFailed

    var errorDescription: String? {
        switch self {
        case .missingSecret: return "No private key imported."
        case .invalidInput: return "Unable to import this key."
        case .pubkeyMismatch: return "Event pubkey does not match the imported key."
        case .signingFailed: return "Unable to sign this event."
        }
    }
}

struct KeyStorageStatus: Equatable {
    let hasSecret: Bool
    let usesSimulatorFallback: Bool

    var userFacingDescription: String {
        if hasSecret {
            return usesSimulatorFallback ? "Key stored in local simulator storage for this test run." : "Key stored on this device."
        }
        return "No key stored on this device."
    }
}

struct KeychainKeyStoreError: Error, LocalizedError, Equatable {
    enum Operation: String, Equatable {
        case store = "storing"
        case update = "updating"
        case delete = "deleting"
    }

    let operation: Operation
    let status: OSStatus

    var errorDescription: String? {
        switch operation {
        case .delete:
            return "We could not remove your key from this device. Your key may still be stored here; please try again before continuing. (Keychain deleting failed: \(status))"
        case .store:
            return "We could not save your key on this device. No key was stored; please try again. (Keychain storing failed: \(status))"
        case .update:
            return "We could not save your key on this device. The existing key was not changed; please try again. (Keychain updating failed: \(status))"
        }
    }
}

enum NostrCryptoProviderError: Error {
    case invalidKeyMaterial
    case unsupported(String)
}

protocol NostrCryptoProviding {
    var algorithmLabel: String { get }
    func publicKeyHex(fromSecretHex secretHex: String) throws -> String
    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String
    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
    func nip04Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
    func nip04Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
}

struct CompatibilityNostrCryptoProvider: NostrCryptoProviding {
    let algorithmLabel = "compat-hmac-sha512-hkdf-sha256"
    private let nip44PrefixV3 = "NIP44COMPAT:v3:"

    func publicKeyHex(fromSecretHex secretHex: String) throws -> String {
        guard let secretBytes = Hex.decode(secretHex), secretBytes.count == 32 else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        let bytes = SHA256.hash(data: secretBytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String {
        guard let keyData = Hex.decode(secretHex), keyData.count == 32,
              let eventIDData = Hex.decode(eventID), eventIDData.count == 32 else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        let mac = HMAC<SHA512>.authenticationCode(for: eventIDData, using: SymmetricKey(data: keyData))
        return Data(mac).map { String(format: "%02x", $0) }.joined()
    }

    private func nip44ConversationKey(localSecretHex: String, peerPubkeyHex: String) throws -> SymmetricKey {
        guard let localSecret = Hex.decode(localSecretHex),
              let peerPubkey = Hex.decode(peerPubkeyHex),
              localSecret.count == 32,
              peerPubkey.count == 32 else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        var ikm = Data()
        ikm.append(localSecret)
        ikm.append(peerPubkey)
        let salt = Data("nostroots:nip44compat:v3:salt".utf8)
        let info = Data("nostroots:nip44compat:v3:key".utf8)
        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: ikm),
            salt: salt,
            info: info,
            outputByteCount: 32
        )
    }

    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        let symmetric = try nip44ConversationKey(localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
        let sealed = try AES.GCM.seal(Data(plainText.utf8), using: symmetric, nonce: AES.GCM.Nonce())
        guard let combined = sealed.combined else { throw NostrCryptoProviderError.invalidKeyMaterial }
        return nip44PrefixV3 + combined.base64EncodedString()
    }

    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        guard cipherText.hasPrefix(nip44PrefixV3) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        let payload = String(cipherText.dropFirst(nip44PrefixV3.count))
        guard let combined = Data(base64Encoded: payload) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        let symmetric = try nip44ConversationKey(localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
        let sealed = try AES.GCM.SealedBox(combined: combined)
        let decrypted = try AES.GCM.open(sealed, using: symmetric)
        guard let plainText = String(data: decrypted, encoding: .utf8) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return plainText
    }

    func nip04Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        try nip44Encrypt(plainText: plainText, localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
    }

    func nip04Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        try nip44Decrypt(cipherText: cipherText, localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
    }
}

enum CryptoProviderFactory {
    static func makeDefaultProvider() -> NostrCryptoProviding {
        switch NRConstants.cryptoRuntimeMode {
        case .compatibility:
            return CompatibilityNostrCryptoProvider()
        case .secp256k1:
            return NostrSDKCryptoProvider()
        }
    }
}

protocol KeyStore {
    func importSecret(_ key: String) throws
    func importGeneratedSecret(_ secretHex: String) throws
    func clearSecret() throws
    func currentSecretHex() -> String?
    func currentPublicKeyHex() -> String?
    func currentMnemonic() -> String?
    func storageStatus() -> KeyStorageStatus
    func sign(unsigned: UnsignedNostrEvent) throws -> NostrEvent
}

final class InMemoryKeyStore: KeyStore {
    fileprivate var secretHex: String?
    private let cryptoProvider: NostrCryptoProviding

    init(cryptoProvider: NostrCryptoProviding = CryptoProviderFactory.makeDefaultProvider()) {
        self.cryptoProvider = cryptoProvider
    }

    func importSecret(_ key: String) throws {
        secretHex = try KeyImportParser.parse(key).secretHex
    }

    func importGeneratedSecret(_ secretHex: String) throws {
        guard NIP19.isValidHex(secretHex, expectedBytes: 32) else {
            throw KeyStoreError.invalidInput
        }
        self.secretHex = secretHex
    }

    func clearSecret() throws {
        secretHex = nil
    }

    func currentSecretHex() -> String? {
        secretHex
    }

    func currentPublicKeyHex() -> String? {
        guard let secretHex else { return nil }
        return try? cryptoProvider.publicKeyHex(fromSecretHex: secretHex)
    }

    func currentMnemonic() -> String? {
        nil
    }

    func storageStatus() -> KeyStorageStatus {
        KeyStorageStatus(hasSecret: secretHex != nil, usesSimulatorFallback: false)
    }

    func sign(unsigned: UnsignedNostrEvent) throws -> NostrEvent {
        try Signer.sign(unsigned: unsigned, secretHex: secretHex, cryptoProvider: cryptoProvider)
    }
}

final class KeychainKeyStore: KeyStore {
    private let inMemory: InMemoryKeyStore
    private let service: String
    private let account: String
    private let mnemonicAccount: String
    private var isUsingSimulatorFallback = false
    private var simulatorFallbackKey: String {
        "nr.simulator-keychain-fallback.\(service).\(account)"
    }

    init(
        cryptoProvider: NostrCryptoProviding = CryptoProviderFactory.makeDefaultProvider(),
        service: String = "org.trustroots.nostroots.browser",
        account: String = "nostroots.browser.privatekey.hex",
        mnemonicAccount: String = "nostroots.browser.mnemonic"
    ) {
        self.service = service
        self.account = account
        self.mnemonicAccount = mnemonicAccount
        inMemory = InMemoryKeyStore(cryptoProvider: cryptoProvider)
        if let existing = loadSecret() {
            do {
                try inMemory.importGeneratedSecret(existing)
            } catch {
                try? clearSecret()
            }
        }
    }

    func importSecret(_ key: String) throws {
        let result = try KeyImportParser.parse(key)
        try saveSecret(result.secretHex)
        try saveMnemonic(result.source == .mnemonic ? normalizedMnemonic(key) : nil)
        try inMemory.importGeneratedSecret(result.secretHex)
    }

    func importGeneratedSecret(_ secretHex: String) throws {
        guard NIP19.isValidHex(secretHex, expectedBytes: 32) else {
            throw KeyStoreError.invalidInput
        }
        try saveSecret(secretHex)
        try saveMnemonic(nil)
        try inMemory.importGeneratedSecret(secretHex)
    }

    func clearSecret() throws {
        let query = keychainLookupQuery()
        let status = SecItemDelete(query as CFDictionary)
        if shouldUseSimulatorFallback(after: status) {
            clearSimulatorFallbackSecret()
            try? saveMnemonic(nil)
            try inMemory.clearSecret()
            return
        }
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainKeyStoreError(operation: .delete, status: status)
        }
        clearSimulatorFallbackSecret()
        try? saveMnemonic(nil)
        try inMemory.clearSecret()
    }

    func currentSecretHex() -> String? {
        inMemory.currentSecretHex()
    }

    func currentPublicKeyHex() -> String? {
        inMemory.currentPublicKeyHex()
    }

    func currentMnemonic() -> String? {
        loadMnemonic()
    }

    func storageStatus() -> KeyStorageStatus {
        KeyStorageStatus(hasSecret: inMemory.currentSecretHex() != nil, usesSimulatorFallback: isUsingSimulatorFallback)
    }

    func sign(unsigned: UnsignedNostrEvent) throws -> NostrEvent {
        try inMemory.sign(unsigned: unsigned)
    }

    private func saveSecret(_ secretHex: String) throws {
        let query = keychainLookupQuery()
        let attributes: [String: Any] = [
            kSecValueData as String: Data(secretHex.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        if status == errSecSuccess {
            let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            guard updateStatus == errSecSuccess else {
                if storeSimulatorFallbackSecret(secretHex, after: updateStatus) {
                    return
                }
                throw KeychainKeyStoreError(operation: .update, status: updateStatus)
            }
            isUsingSimulatorFallback = false
            return
        }

        var create = query
        attributes.forEach { create[$0.key] = $0.value }
        let createStatus = SecItemAdd(create as CFDictionary, nil)
        guard createStatus == errSecSuccess else {
            if storeSimulatorFallbackSecret(secretHex, after: createStatus) {
                return
            }
            throw KeychainKeyStoreError(operation: .store, status: createStatus)
        }
        isUsingSimulatorFallback = false
    }

    private func loadSecret() -> String? {
        var query = keychainLookupQuery()
        query.merge([
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]) { _, new in new }
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return loadSimulatorFallbackSecret() }
        isUsingSimulatorFallback = false
        return String(data: data, encoding: .utf8)
    }

    private func keychainLookupQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func mnemonicLookupQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: mnemonicAccount
        ]
    }

    private func saveMnemonic(_ mnemonic: String?) throws {
        let query = mnemonicLookupQuery()
        let deleteStatus = SecItemDelete(query as CFDictionary)
        guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound || shouldUseSimulatorFallback(after: deleteStatus) else {
            throw KeychainKeyStoreError(operation: .delete, status: deleteStatus)
        }

        #if targetEnvironment(simulator)
        UserDefaults.standard.removeObject(forKey: "\(simulatorFallbackKey).mnemonic")
        #endif

        guard let mnemonic else { return }
        var create = query
        create[kSecValueData as String] = Data(mnemonic.utf8)
        create[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let createStatus = SecItemAdd(create as CFDictionary, nil)
        guard createStatus == errSecSuccess else {
            #if targetEnvironment(simulator)
            if shouldUseSimulatorFallback(after: createStatus) {
                UserDefaults.standard.set(mnemonic, forKey: "\(simulatorFallbackKey).mnemonic")
                return
            }
            #endif
            throw KeychainKeyStoreError(operation: .store, status: createStatus)
        }
    }

    private func loadMnemonic() -> String? {
        var query = mnemonicLookupQuery()
        query.merge([
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]) { _, new in new }
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            #if targetEnvironment(simulator)
            return UserDefaults.standard.string(forKey: "\(simulatorFallbackKey).mnemonic")
            #else
            return nil
            #endif
        }
        return String(data: data, encoding: .utf8)
    }

    private func normalizedMnemonic(_ key: String) -> String {
        key
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
    }

    private func storeSimulatorFallbackSecret(_ secretHex: String, after status: OSStatus) -> Bool {
        #if targetEnvironment(simulator)
        guard shouldUseSimulatorFallback(after: status) else {
            return false
        }
        UserDefaults.standard.set(secretHex, forKey: simulatorFallbackKey)
        isUsingSimulatorFallback = true
        return true
        #else
        _ = secretHex
        _ = status
        return false
        #endif
    }

    private func loadSimulatorFallbackSecret() -> String? {
        #if targetEnvironment(simulator)
        let value = UserDefaults.standard.string(forKey: simulatorFallbackKey)
        isUsingSimulatorFallback = value != nil
        return value
        #else
        return nil
        #endif
    }

    private func clearSimulatorFallbackSecret() {
        #if targetEnvironment(simulator)
        UserDefaults.standard.removeObject(forKey: simulatorFallbackKey)
        UserDefaults.standard.removeObject(forKey: "\(simulatorFallbackKey).mnemonic")
        #endif
        isUsingSimulatorFallback = false
    }

    private func shouldUseSimulatorFallback(after status: OSStatus) -> Bool {
        #if targetEnvironment(simulator)
        return status != errSecSuccess
        #else
        _ = status
        return false
        #endif
    }
}

private enum Signer {
    static func sign(
        unsigned: UnsignedNostrEvent,
        secretHex: String?,
        cryptoProvider: NostrCryptoProviding
    ) throws -> NostrEvent {
        guard let secretHex else { throw KeyStoreError.missingSecret }
        let expectedPubkey: String
        do {
            expectedPubkey = try cryptoProvider.publicKeyHex(fromSecretHex: secretHex)
        } catch {
            throw KeyStoreError.invalidInput
        }
        guard unsigned.pubkey == expectedPubkey else {
            throw KeyStoreError.pubkeyMismatch
        }
        let eventID = try NIP01.eventIDHex(for: unsigned)
        let signature: String
        do {
            signature = try cryptoProvider.signEventIDHex(eventID, secretHex: secretHex)
        } catch {
            throw KeyStoreError.signingFailed
        }
        return NostrEvent(
            id: eventID,
            pubkey: unsigned.pubkey,
            createdAt: unsigned.createdAt,
            kind: unsigned.kind,
            tags: unsigned.tags,
            content: unsigned.content,
            sig: signature
        )
    }
}
