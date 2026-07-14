import Foundation

enum NIP42Auth {
    static func makeAuthEvent(
        challenge: String,
        relayURL: URL,
        keyStore: KeyStore
    ) throws -> NostrEvent {
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            throw KeyStoreError.missingSecret
        }
        let unsigned = NostrEventFactory.makeUnsigned(
            pubkey: pubkey,
            kind: NRConstants.authEventKind,
            tags: [
                ["relay", relayURL.absoluteString],
                ["challenge", challenge]
            ],
            content: ""
        )
        return try keyStore.sign(unsigned: unsigned)
    }
}

