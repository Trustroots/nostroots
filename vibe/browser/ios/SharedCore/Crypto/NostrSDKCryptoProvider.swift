import CryptoKit
import Foundation
#if canImport(NostrSDK)
import NostrSDK
#endif

#if canImport(NostrSDK)
struct NostrSDKCryptoProvider: NostrCryptoProviding, ContentSigning, NIP44v2Encrypting, LegacyDirectMessageEncrypting {
    static let isLinked = true
    let algorithmLabel = "nostr-sdk-ios-e5855cbd-secp256k1-schnorr-nip44v2"

    func publicKeyHex(fromSecretHex secretHex: String) throws -> String {
        guard let keypair = NostrSDK.Keypair(hex: secretHex) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return keypair.publicKey.hex
    }

    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String {
        guard let eventIDData = Hex.decode(eventID), eventIDData.count == 32,
              NostrSDK.PrivateKey(hex: secretHex) != nil else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        _ = eventIDData
        return try signatureForContent(eventID, privateKey: secretHex)
    }

    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        guard let privateKey = NostrSDK.PrivateKey(hex: localSecretHex),
              let publicKey = NostrSDK.PublicKey(hex: peerPubkeyHex) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return try encrypt(plaintext: plainText, privateKeyA: privateKey, publicKeyB: publicKey)
    }

    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        guard let privateKey = NostrSDK.PrivateKey(hex: localSecretHex),
              let publicKey = NostrSDK.PublicKey(hex: peerPubkeyHex) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return try decrypt(payload: cipherText, privateKeyA: privateKey, publicKeyB: publicKey)
    }

    func nip04Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        guard let privateKey = NostrSDK.PrivateKey(hex: localSecretHex),
              let publicKey = NostrSDK.PublicKey(hex: peerPubkeyHex) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return try legacyEncrypt(content: plainText, privateKey: privateKey, publicKey: publicKey)
    }

    func nip04Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        guard let privateKey = NostrSDK.PrivateKey(hex: localSecretHex),
              let publicKey = NostrSDK.PublicKey(hex: peerPubkeyHex) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return try legacyDecrypt(encryptedContent: cipherText, privateKey: privateKey, publicKey: publicKey)
    }
}
#else
struct NostrSDKCryptoProvider: NostrCryptoProviding {
    static let isLinked = false
    let algorithmLabel = "nostr-sdk-ios-unavailable"

    func publicKeyHex(fromSecretHex secretHex: String) throws -> String {
        _ = secretHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }

    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String {
        _ = eventID
        _ = secretHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }

    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = plainText
        _ = localSecretHex
        _ = peerPubkeyHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }

    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = cipherText
        _ = localSecretHex
        _ = peerPubkeyHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }

    func nip04Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = plainText
        _ = localSecretHex
        _ = peerPubkeyHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }

    func nip04Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = cipherText
        _ = localSecretHex
        _ = peerPubkeyHex
        throw NostrCryptoProviderError.unsupported("NostrSDK package is not linked in this build.")
    }
}
#endif
