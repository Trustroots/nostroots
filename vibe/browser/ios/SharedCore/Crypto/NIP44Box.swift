import CryptoKit
import Foundation

enum NIP44BoxError: Error {
    case invalidPayload
    case invalidKeyMaterial
}

protocol NIP44Boxing {
    func encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
    func decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String
}

struct NIP44Box: NIP44Boxing {
    private let prefixV2 = "NIP44COMPAT:v2:"
    private let prefixV3 = "NIP44COMPAT:v3:"
    private let cryptoProvider: NostrCryptoProviding

    init(cryptoProvider: NostrCryptoProviding = CryptoProviderFactory.makeDefaultProvider()) {
        self.cryptoProvider = cryptoProvider
    }

    func encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        do {
            return try cryptoProvider.nip44Encrypt(plainText: plainText, localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
        } catch {
            throw NIP44BoxError.invalidKeyMaterial
        }
    }

    func decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        if cipherText.hasPrefix(prefixV2) {
            return try decryptV2Compatibility(cipherText: cipherText, localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
        }
        if cipherText.hasPrefix(prefixV3) {
            return try CompatibilityNostrCryptoProvider().nip44Decrypt(
                cipherText: cipherText,
                localSecretHex: localSecretHex,
                peerPubkeyHex: peerPubkeyHex
            )
        }
        do {
            return try cryptoProvider.nip44Decrypt(cipherText: cipherText, localSecretHex: localSecretHex, peerPubkeyHex: peerPubkeyHex)
        } catch {
            throw NIP44BoxError.invalidPayload
        }
    }

    private func decryptV2Compatibility(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        let b64 = String(cipherText.dropFirst(prefixV2.count))
        guard let combined = Data(base64Encoded: b64) else { throw NIP44BoxError.invalidPayload }
        let sealed = try AES.GCM.SealedBox(combined: combined)
        guard let localSecret = Hex.decode(localSecretHex),
              let peerPubkey = Hex.decode(peerPubkeyHex) else {
            throw NIP44BoxError.invalidKeyMaterial
        }
        var material = Data()
        material.append(localSecret)
        material.append(peerPubkey)
        material.append(Data("nip44-compat-v2".utf8))
        let digest = SHA256.hash(data: material)
        let decrypted = try AES.GCM.open(sealed, using: SymmetricKey(data: Data(digest)))
        guard let plain = String(data: decrypted, encoding: .utf8) else {
            throw NIP44BoxError.invalidPayload
        }
        return plain
    }
}
