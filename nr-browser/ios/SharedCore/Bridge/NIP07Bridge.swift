import Foundation

enum NIP07BridgeError: Error, LocalizedError, Equatable {
    case invalidMessage
    case unknownMethod
    case invalidParams
    case invalidPeerPubkey
    case missingKey
    case permissionDenied
    case operationFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidMessage: return "Invalid bridge message."
        case .unknownMethod: return "Unknown NIP-07 method."
        case .invalidParams: return "Invalid NIP-07 parameters."
        case .invalidPeerPubkey: return "Invalid peer public key."
        case .missingKey: return "No private key is stored in Nostroots Browser."
        case .permissionDenied: return "This website is not allowed to use the Nostroots Browser NIP-07 key."
        case .operationFailed(let message): return message
        }
    }
}

struct NIP07BridgeResponse {
    let id: String
    let ok: Bool
    let result: Any?
    let error: String?

    func jsonObject() -> [String: Any] {
        var object: [String: Any] = [
            "source": "nostroots-nip7-bridge",
            "id": id,
            "ok": ok
        ]
        if let result {
            object["result"] = result
        }
        if let error {
            object["error"] = error
        }
        return object
    }
}

final class NIP07Bridge {
    static let knownMethods = Set([
        "getPublicKey",
        "signEvent",
        "nip44.encrypt",
        "nip44.decrypt",
        "nip04.encrypt",
        "nip04.decrypt"
    ])

    private let keyStore: KeyStore
    private let cryptoProvider: NostrCryptoProviding
    private let encoder: JSONEncoder

    init(keyStore: KeyStore, cryptoProvider: NostrCryptoProviding = CryptoProviderFactory.makeDefaultProvider()) {
        self.keyStore = keyStore
        self.cryptoProvider = cryptoProvider
        self.encoder = JSONEncoder()
    }

    func handle(_ raw: Any) -> NIP07BridgeResponse {
        guard
            let message = raw as? [String: Any],
            message["source"] as? String == "nostroots-nip7-bridge",
            let id = message["id"] as? String,
            let method = message["method"] as? String
        else {
            return .failure(id: "unknown", error: .invalidMessage)
        }

        do {
            let result = try handle(method: method, params: message["params"])
            return .success(id: id, result: result)
        } catch let error as NIP07BridgeError {
            return .failure(id: id, error: error)
        } catch {
            return .failure(id: id, error: .operationFailed(error.localizedDescription))
        }
    }

    func handle(method: String, params: Any?) throws -> Any {
        guard Self.knownMethods.contains(method) else {
            throw NIP07BridgeError.unknownMethod
        }

        switch method {
        case "getPublicKey":
            guard let pubkey = keyStore.currentPublicKeyHex() else { throw NIP07BridgeError.missingKey }
            return pubkey

        case "signEvent":
            guard let rawParams = params as? [Any], rawParams.count == 1,
                  let eventObject = rawParams[0] as? [String: Any] else {
                throw NIP07BridgeError.invalidParams
            }
            return try signEvent(eventObject)

        case "nip44.encrypt":
            let (peer, text) = try peerAndTextParams(params)
            guard let secret = keyStore.currentSecretHex() else { throw NIP07BridgeError.missingKey }
            return try cryptoProvider.nip44Encrypt(plainText: text, localSecretHex: secret, peerPubkeyHex: peer)

        case "nip44.decrypt":
            let (peer, text) = try peerAndTextParams(params)
            guard let secret = keyStore.currentSecretHex() else { throw NIP07BridgeError.missingKey }
            return try cryptoProvider.nip44Decrypt(cipherText: text, localSecretHex: secret, peerPubkeyHex: peer)

        case "nip04.encrypt":
            let (peer, text) = try peerAndTextParams(params)
            guard let secret = keyStore.currentSecretHex() else { throw NIP07BridgeError.missingKey }
            return try cryptoProvider.nip04Encrypt(plainText: text, localSecretHex: secret, peerPubkeyHex: peer)

        case "nip04.decrypt":
            let (peer, text) = try peerAndTextParams(params)
            guard let secret = keyStore.currentSecretHex() else { throw NIP07BridgeError.missingKey }
            return try cryptoProvider.nip04Decrypt(cipherText: text, localSecretHex: secret, peerPubkeyHex: peer)

        default:
            throw NIP07BridgeError.unknownMethod
        }
    }

    private func signEvent(_ eventObject: [String: Any]) throws -> [String: Any] {
        guard let pubkey = keyStore.currentPublicKeyHex() else { throw NIP07BridgeError.missingKey }
        guard let kind = intValue(eventObject["kind"]),
              let content = eventObject["content"] as? String,
              let tags = stringTags(eventObject["tags"]) else {
            throw NIP07BridgeError.invalidParams
        }

        let createdAt = intValue(eventObject["created_at"]) ?? Int(Date().timeIntervalSince1970)
        let unsigned = UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: createdAt,
            kind: kind,
            tags: tags,
            content: content
        )
        let signed = try keyStore.sign(unsigned: unsigned)
        let data = try encoder.encode(signed)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NIP07BridgeError.operationFailed("Unable to encode signed event.")
        }
        return object
    }

    private func intValue(_ value: Any?) -> Int? {
        if let int = value as? Int { return int }
        if let number = value as? NSNumber { return number.intValue }
        return nil
    }

    private func stringTags(_ value: Any?) -> [[String]]? {
        guard let rawTags = value as? [Any] else { return nil }
        var tags: [[String]] = []
        for rawTag in rawTags {
            guard let rawParts = rawTag as? [Any] else { return nil }
            var tag: [String] = []
            for rawPart in rawParts {
                guard let part = rawPart as? String else { return nil }
                tag.append(part)
            }
            tags.append(tag)
        }
        return tags
    }

    private func peerAndTextParams(_ params: Any?) throws -> (String, String) {
        guard let rawParams = params as? [Any], rawParams.count == 2,
              let peer = rawParams[0] as? String,
              let text = rawParams[1] as? String else {
            throw NIP07BridgeError.invalidParams
        }
        guard NIP19.isValidHex(peer.lowercased(), expectedBytes: 32) else {
            throw NIP07BridgeError.invalidPeerPubkey
        }
        return (peer.lowercased(), text)
    }
}

extension NIP07BridgeResponse {
    static func success(id: String, result: Any?) -> NIP07BridgeResponse {
        NIP07BridgeResponse(id: id, ok: true, result: result, error: nil)
    }

    static func failure(id: String, error: NIP07BridgeError) -> NIP07BridgeResponse {
        NIP07BridgeResponse(id: id, ok: false, result: nil, error: error.localizedDescription)
    }
}
