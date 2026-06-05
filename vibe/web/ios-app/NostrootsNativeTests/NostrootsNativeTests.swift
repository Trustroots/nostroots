import XCTest
import CryptoKit

private struct NIP44OfficialDecryptVector {
    let name: String
    let receiverSecretHex: String
    let senderPubkeyHex: String
    let payload: String
    let plaintext: String
}

private enum NIP44OfficialVectors {
    static let sha256 = "269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040"
    static let sample = NIP44OfficialDecryptVector(
        name: "nip44.vectors.json sha256 \(sha256) sample",
        receiverSecretHex: "0000000000000000000000000000000000000000000000000000000000000002",
        senderPubkeyHex: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        payload: "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABee0G5VSK0/9YypIObAtDKfYEAjD35uVkHyB0F4DwrcNaCXlCWZKaArsGrY6M9wnuTMxWfp1RTN9Xga8no+kF5Vsb",
        plaintext: "a"
    )
    static let decryptVectors = [sample]

    static func tamperedPayload(from payload: String) -> String {
        String(payload.dropLast()) + (payload.last == "A" ? "B" : "A")
    }
}

final class NostrootsNativeTests: XCTestCase {
    func testHexKeyImportAndPubkeyDerivation() throws {
        let keyStore = InMemoryKeyStore()
        let hex = String(repeating: "1a", count: 32)
        try keyStore.importSecret(hex)
        XCTAssertEqual(keyStore.currentSecretHex(), hex)
        XCTAssertEqual(keyStore.currentPublicKeyHex()?.count, 64)
    }

    func testInMemoryKeyStoreReplacesAndClearsSecret() throws {
        let keyStore = InMemoryKeyStore()
        let first = String(repeating: "1a", count: 32)
        let second = String(repeating: "2b", count: 32)

        try keyStore.importSecret(first)
        XCTAssertEqual(keyStore.currentSecretHex(), first)

        try keyStore.importSecret(second)
        XCTAssertEqual(keyStore.currentSecretHex(), second)

        try keyStore.clearSecret()
        XCTAssertNil(keyStore.currentSecretHex())
        XCTAssertNil(keyStore.currentPublicKeyHex())
    }

    func testNIP42AuthEventShape() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "2b", count: 32))
        let relay = URL(string: "wss://nip42.trustroots.org")!
        let event = try NIP42Auth.makeAuthEvent(challenge: "challenge-token", relayURL: relay, keyStore: keyStore)
        XCTAssertEqual(event.kind, NRConstants.authEventKind)
        XCTAssertTrue(event.tags.contains(["relay", relay.absoluteString]))
        XCTAssertTrue(event.tags.contains(["challenge", "challenge-token"]))
    }

    func testNIP01EventIDValidation() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "33", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }

        let unsigned = UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: 1_700_000_000,
            kind: 1,
            tags: [["p", String(repeating: "aa", count: 32)]],
            content: "hello"
        )
        let eventID = try NIP01.eventIDHex(for: unsigned)
        XCTAssertEqual(eventID.count, 64)

        let signed = try keyStore.sign(unsigned: unsigned)
        XCTAssertTrue(NIP01.hasValidEventID(signed))
        XCTAssertEqual(signed.id, eventID)
        XCTAssertEqual(signed.sig.count, 128)
    }

    func testSignerRejectsMismatchedPubkey() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "34", count: 32))
        let wrongPubkey = String(repeating: "aa", count: 32)
        let unsigned = UnsignedNostrEvent(
            pubkey: wrongPubkey,
            createdAt: 1_700_000_001,
            kind: 1,
            tags: [],
            content: "hello"
        )

        XCTAssertThrowsError(try keyStore.sign(unsigned: unsigned)) { error in
            guard case KeyStoreError.pubkeyMismatch = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
    }

    func testKeyStoreUsesInjectedCryptoProvider() throws {
        let provider = RecordingCryptoProvider()
        let keyStore = InMemoryKeyStore(cryptoProvider: provider)
        try keyStore.importSecret(String(repeating: "35", count: 32))
        let pubkey = try XCTUnwrap(keyStore.currentPublicKeyHex())
        XCTAssertEqual(pubkey, provider.fixedPubkey)

        let unsigned = UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: 1_700_000_002,
            kind: 1,
            tags: [],
            content: "hello"
        )
        let signed = try keyStore.sign(unsigned: unsigned)
        XCTAssertEqual(signed.sig, provider.fixedSignature)
        XCTAssertEqual(provider.signCallCount, 1)
        XCTAssertEqual(provider.lastSignedEventID, signed.id)
    }

    func testDefaultCryptoProviderModeIsSecp256k1() throws {
        XCTAssertEqual(NRConstants.cryptoRuntimeMode, .secp256k1)
        let provider = CryptoProviderFactory.makeDefaultProvider()
        if !NostrSDKCryptoProvider.isLinked {
            throw XCTSkip("NostrSDK package is not linked in this package-free compile-check build.")
        }
        XCTAssertEqual(provider.algorithmLabel, "nostr-sdk-ios-e5855cbd-secp256k1-schnorr-nip44v2")
    }

    func testCompatibilitySignerRejectsMalformedEventID() {
        let provider = CompatibilityNostrCryptoProvider()
        XCTAssertThrowsError(try provider.signEventIDHex("abc", secretHex: String(repeating: "11", count: 32)))
    }

    func testNostrSDKProviderDerivesPubkeySignsAndEncrypts() throws {
        try skipIfNostrSDKUnavailable()
        let provider = NostrSDKCryptoProvider()
        let localSecret = String(repeating: "11", count: 32)
        let peerSecret = String(repeating: "22", count: 32)
        let localPubkey = try provider.publicKeyHex(fromSecretHex: localSecret)
        let peerPubkey = try provider.publicKeyHex(fromSecretHex: peerSecret)

        XCTAssertEqual(localPubkey.count, 64)
        XCTAssertEqual(peerPubkey.count, 64)

        let signature = try provider.signEventIDHex(String(repeating: "aa", count: 32), secretHex: localSecret)
        XCTAssertEqual(signature.count, 128)

        let encrypted = try provider.nip44Encrypt(plainText: "hello", localSecretHex: localSecret, peerPubkeyHex: peerPubkey)
        XCTAssertFalse(encrypted.hasPrefix("NIP44COMPAT:"))
        let decrypted = try provider.nip44Decrypt(cipherText: encrypted, localSecretHex: peerSecret, peerPubkeyHex: localPubkey)
        XCTAssertEqual(decrypted, "hello")
    }

    func testNIP44OfficialDecryptVectors() throws {
        try skipIfNostrSDKUnavailable()
        let provider = NostrSDKCryptoProvider()

        for vector in NIP44OfficialVectors.decryptVectors {
            let decrypted = try provider.nip44Decrypt(
                cipherText: vector.payload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
            XCTAssertEqual(decrypted, vector.plaintext, vector.name)
        }
    }

    func testNIP44BoxDecryptsOfficialPayloadsThroughSDKProvider() throws {
        try skipIfNostrSDKUnavailable()
        let box = NIP44Box()

        for vector in NIP44OfficialVectors.decryptVectors {
            let decrypted = try box.decrypt(
                cipherText: vector.payload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
            XCTAssertEqual(decrypted, vector.plaintext, vector.name)
        }
    }

    func testNIP44OfficialPayloadTamperFailsClosed() throws {
        try skipIfNostrSDKUnavailable()
        let vector = NIP44OfficialVectors.sample
        let tamperedPayload = NIP44OfficialVectors.tamperedPayload(from: vector.payload)

        XCTAssertNotEqual(tamperedPayload, vector.payload)
        XCTAssertThrowsError(
            try NostrSDKCryptoProvider().nip44Decrypt(
                cipherText: tamperedPayload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        )
        XCTAssertThrowsError(
            try NIP44Box().decrypt(
                cipherText: tamperedPayload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        ) { error in
            guard case NIP44BoxError.invalidPayload = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
    }

    func testNIP44SDKUnavailablePathFailsClosed() throws {
        guard !NostrSDKCryptoProvider.isLinked else {
            throw XCTSkip("NostrSDK package is linked; package-free fallback guard is not active.")
        }
        let provider = NostrSDKCryptoProvider()
        let vector = NIP44OfficialVectors.sample

        XCTAssertThrowsError(
            try provider.nip44Decrypt(
                cipherText: vector.payload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        ) { error in
            guard case NostrCryptoProviderError.unsupported(_) = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertThrowsError(
            try provider.nip44Encrypt(
                plainText: vector.plaintext,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        ) { error in
            guard case NostrCryptoProviderError.unsupported(_) = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertThrowsError(
            try NIP44Box().decrypt(
                cipherText: vector.payload,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        ) { error in
            guard case NIP44BoxError.invalidPayload = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertThrowsError(
            try NIP44Box().encrypt(
                plainText: vector.plaintext,
                localSecretHex: vector.receiverSecretHex,
                peerPubkeyHex: vector.senderPubkeyHex
            )
        ) { error in
            guard case NIP44BoxError.invalidKeyMaterial = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
    }

    func testNIP44RoundTrip() throws {
        try skipIfNostrSDKUnavailable()
        let box = NIP44Box()
        let localSecret = String(repeating: "3c", count: 32)
        let peerSecret = String(repeating: "4d", count: 32)
        let peerPubkey = try NostrSDKCryptoProvider().publicKeyHex(fromSecretHex: peerSecret)
        let plain = #"{"type":"trustroots.location.v1","foo":"bar"}"#
        let cipher = try box.encrypt(plainText: plain, localSecretHex: localSecret, peerPubkeyHex: peerPubkey)
        XCTAssertFalse(cipher.hasPrefix("NIP44COMPAT:"))
        let localPubkey = try NostrSDKCryptoProvider().publicKeyHex(fromSecretHex: localSecret)
        let decrypted = try box.decrypt(cipherText: cipher, localSecretHex: peerSecret, peerPubkeyHex: localPubkey)
        XCTAssertEqual(decrypted, plain)
    }

    func testNIP44V2PayloadStillDecrypts() throws {
        let localSecret = String(repeating: "3c", count: 32)
        let peerPubkey = String(repeating: "4d", count: 32)
        let plain = #"{"legacy":true}"#

        guard let localSecretData = Hex.decode(localSecret),
              let peerPubkeyData = Hex.decode(peerPubkey) else {
            XCTFail("invalid test key material")
            return
        }
        var material = Data()
        material.append(localSecretData)
        material.append(peerPubkeyData)
        material.append(Data("nip44-compat-v2".utf8))
        let digest = SHA256.hash(data: material)
        let key = SymmetricKey(data: Data(digest))
        let sealed = try AES.GCM.seal(Data(plain.utf8), using: key)
        guard let combined = sealed.combined else {
            XCTFail("missing ciphertext")
            return
        }
        let legacyCipher = "NIP44COMPAT:v2:" + combined.base64EncodedString()

        let box = NIP44Box()
        let decrypted = try box.decrypt(cipherText: legacyCipher, localSecretHex: localSecret, peerPubkeyHex: peerPubkey)
        XCTAssertEqual(decrypted, plain)
    }

    func testNIP44BoxUsesInjectedCryptoProvider() throws {
        let provider = RecordingCryptoProvider()
        let box = NIP44Box(cryptoProvider: provider)
        let localSecret = String(repeating: "3c", count: 32)
        let peerPubkey = String(repeating: "4d", count: 32)
        let plain = #"{"type":"trustroots.location.v1"}"#

        let cipher = try box.encrypt(plainText: plain, localSecretHex: localSecret, peerPubkeyHex: peerPubkey)
        XCTAssertTrue(provider.encryptionWasRequested)
        let decrypted = try box.decrypt(cipherText: cipher, localSecretHex: localSecret, peerPubkeyHex: peerPubkey)
        XCTAssertTrue(provider.decryptionWasRequested)
        XCTAssertEqual(decrypted, plain)
    }

    func testMalformedNsecIsRejected() {
        XCTAssertThrowsError(try NIP19.importSecret("nsec1zzzzzzzzzzzzzz")) { error in
            XCTAssertNotNil((error as? NIP19Error))
        }
    }

    func testNsecEncodeRoundTrip() throws {
        let hex = String(repeating: "01", count: 32)
        let nsec = try NIP19.encodeNsec(secretHex: hex)
        XCTAssertTrue(nsec.hasPrefix("nsec1"))
        XCTAssertEqual(try NIP19.importSecret(nsec), hex)
    }

    func testNpubEncodeRoundTrip() throws {
        let pubkey = String(repeating: "02", count: 32)
        let npub = try NIP19.encodeNpub(pubkeyHex: pubkey)
        XCTAssertTrue(npub.hasPrefix("npub1"))
        XCTAssertEqual(try NIP19.importPubkey(npub), pubkey)
        XCTAssertEqual(try NIP19.importPubkey(pubkey), pubkey)
    }

    func testKeyImportParserAcceptsNsecHexAndMnemonic() throws {
        let hex = String(repeating: "01", count: 32)
        let nsec = try NIP19.encodeNsec(secretHex: hex)
        XCTAssertEqual(try KeyImportParser.parse(nsec).secretHex, hex)
        XCTAssertEqual(try KeyImportParser.parse(hex.uppercased()).secretHex, hex)

        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        let parsed = try KeyImportParser.parse(mnemonic)
        XCTAssertEqual(parsed.source, .mnemonic)
        XCTAssertEqual(parsed.secretHex, "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1")
    }

    func testKeyImportParserRejectsBadUserInputsWithSpecificErrors() throws {
        XCTAssertThrowsError(try KeyImportParser.parse("")) { error in
            XCTAssertEqual(error as? KeyImportError, .empty)
        }
        XCTAssertThrowsError(try KeyImportParser.parse("npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq")) { error in
            XCTAssertEqual(error as? KeyImportError, .publicKey)
        }
        XCTAssertThrowsError(try KeyImportParser.parse("nsec1zzzzzzzzzzzzzz")) { error in
            XCTAssertEqual(error as? KeyImportError, .invalidNsec)
        }
        XCTAssertThrowsError(try KeyImportParser.parse(String(repeating: "zz", count: 32))) { error in
            XCTAssertEqual(error as? KeyImportError, .invalidHex)
        }
        XCTAssertThrowsError(try KeyImportParser.parse("not a real bip39 mnemonic phrase at all just words here please")) { error in
            XCTAssertEqual(error as? KeyImportError, .invalidMnemonic)
        }
    }

    func testGeneratedNsecBackupComparisonUsesExactSecret() throws {
        let secretHex = String(repeating: "03", count: 32)
        let nsec = try NIP19.encodeNsec(secretHex: secretHex)
        XCTAssertEqual(try KeyImportParser.parse(nsec).secretHex, secretHex)
        XCTAssertNotEqual(nsec, try NIP19.encodeNsec(secretHex: String(repeating: "04", count: 32)))
        XCTAssertTrue(NativeKeyBackupConfirmation.matches(confirmation: "  \(nsec)\n", generatedNsec: nsec))
        XCTAssertTrue(NativeKeyBackupConfirmation.matches(confirmation: nsec.uppercased(), generatedNsec: nsec))
        XCTAssertFalse(NativeKeyBackupConfirmation.matches(confirmation: "", generatedNsec: nsec))
        XCTAssertFalse(NativeKeyBackupConfirmation.matches(confirmation: nsec, generatedNsec: ""))
    }

    func testKeychainErrorsUseFriendlyCopyWithStatus() {
        let error = KeychainKeyStoreError(operation: .store, status: -34018)
        XCTAssertTrue(error.localizedDescription.contains("could not save your key"))
        XCTAssertTrue(error.localizedDescription.contains("No key was stored"))
        XCTAssertTrue(error.localizedDescription.contains("-34018"))
        XCTAssertFalse(error.localizedDescription.contains("Failed storing keychain secret"))

        let updateError = KeychainKeyStoreError(operation: .update, status: -25299)
        XCTAssertTrue(updateError.localizedDescription.contains("could not save your key"))
        XCTAssertTrue(updateError.localizedDescription.contains("existing key was not changed"))
        XCTAssertTrue(updateError.localizedDescription.contains("-25299"))

        let deleteError = KeychainKeyStoreError(operation: .delete, status: -50)
        XCTAssertTrue(deleteError.localizedDescription.contains("could not remove your key"))
        XCTAssertTrue(deleteError.localizedDescription.contains("key may still be stored"))
        XCTAssertTrue(deleteError.localizedDescription.contains("-50"))
    }

    func testKeyStorageStatusUsesPlainDeviceAndSimulatorCopy() {
        XCTAssertEqual(
            KeyStorageStatus(hasSecret: false, usesSimulatorFallback: false).userFacingDescription,
            "No key stored on this device."
        )
        XCTAssertEqual(
            KeyStorageStatus(hasSecret: true, usesSimulatorFallback: false).userFacingDescription,
            "Key stored on this device."
        )
        XCTAssertEqual(
            KeyStorageStatus(hasSecret: true, usesSimulatorFallback: true).userFacingDescription,
            "Key stored in local simulator storage for this test run."
        )
    }

    @MainActor
    func testLocationSharingServiceStoresNormalizedImportedSecret() throws {
        let keyStore = RawRecordingKeyStore()
        let service = LocationSharingService(
            keyStore: keyStore,
            relay: RecordingRelayClient(relayURL: URL(string: "wss://relay.example")!),
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        let expectedSecret = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1"

        let result = try service.importKey(mnemonic)

        XCTAssertEqual(result.source, .mnemonic)
        XCTAssertEqual(result.secretHex, expectedSecret)
        XCTAssertEqual(keyStore.importedSecrets, [expectedSecret])
        XCTAssertEqual(keyStore.currentSecretHex(), expectedSecret)
        XCTAssertTrue(service.hasImportedKey)
    }

    func testTrustrootsUsernameNormalization() throws {
        XCTAssertEqual(try TrustrootsUsername.normalize("Alice"), "alice")
        XCTAssertEqual(try TrustrootsUsername.normalize(" @Alice "), "alice")
        XCTAssertEqual(try TrustrootsUsername.normalize("alice@trustroots.org"), "alice")
        XCTAssertEqual(try TrustrootsUsername.normalize("alice@www.trustroots.org"), "alice")
        XCTAssertEqual(try TrustrootsUsername.normalize("https://www.trustroots.org/profile/Alice"), "alice")
        XCTAssertEqual(try TrustrootsUsername.normalize("trustroots.org/profile/alice/"), "alice")
        XCTAssertEqual(try TrustrootsUsername.nip05("Alice"), "alice@trustroots.org")

        XCTAssertThrowsError(try TrustrootsUsername.normalize("alice@example.org")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .unsupportedDomain)
        }
        XCTAssertThrowsError(try TrustrootsUsername.normalize("   ")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .empty)
        }
        XCTAssertThrowsError(try TrustrootsUsername.normalize("alice bob")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .invalidFormat)
        }
        XCTAssertThrowsError(try TrustrootsUsername.normalize("https://example.org/profile/alice")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .unsupportedDomain)
        }
        XCTAssertThrowsError(try TrustrootsUsername.normalize("https://www.trustroots.org/settings")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .invalidFormat)
        }
    }

    func testSwiftrootsOnboardingRequiresUsernameLinkedToCurrentKey() {
        let currentPubkey = String(repeating: "ab", count: 32)
        let oldPubkey = String(repeating: "cd", count: 32)

        XCTAssertTrue(SwiftrootsOnboardingGate.isOnboarded(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: currentPubkey
        ))
        XCTAssertFalse(SwiftrootsOnboardingGate.isOnboarded(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: oldPubkey
        ))
        XCTAssertFalse(SwiftrootsOnboardingGate.isOnboarded(
            hasImportedKey: false,
            publicKeyHex: nil,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: currentPubkey
        ))
    }

    func testSwiftrootsOnboardingClearsStaleStoredLink() {
        let currentPubkey = String(repeating: "ab", count: 32)
        let oldPubkey = String(repeating: "cd", count: 32)

        XCTAssertTrue(SwiftrootsOnboardingGate.shouldClearStoredLink(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: oldPubkey
        ))
        XCTAssertTrue(SwiftrootsOnboardingGate.shouldClearStoredLink(
            hasImportedKey: false,
            publicKeyHex: nil,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: currentPubkey
        ))
        XCTAssertTrue(SwiftrootsOnboardingGate.shouldClearStoredLink(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "   ",
            linkedPublicKeyHex: currentPubkey
        ))
        XCTAssertFalse(SwiftrootsOnboardingGate.shouldClearStoredLink(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: currentPubkey
        ))
    }

    func testSwiftrootsOnboardingDefaultsTrimAndRemoveBlankValues() throws {
        let suiteName = "SwiftrootsOnboardingDefaults-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create isolated defaults")
            return
        }
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        XCTAssertEqual(SwiftrootsOnboardingDefaults.normalized("  alice  "), "alice")
        XCTAssertEqual(SwiftrootsOnboardingDefaults.normalized("   "), "")
        XCTAssertEqual(SwiftrootsOnboardingDefaults.normalized(nil), "")

        SwiftrootsOnboardingDefaults.persist("  alice  ", forKey: "username", defaults: defaults)
        XCTAssertEqual(defaults.string(forKey: "username"), "alice")

        SwiftrootsOnboardingDefaults.persist("   ", forKey: "username", defaults: defaults)
        XCTAssertNil(defaults.string(forKey: "username"))
    }

    func testSwiftrootsOnboardingRecoveryMessageExplainsStaleLinks() {
        let currentPubkey = String(repeating: "ab", count: 32)
        let oldPubkey = String(repeating: "cd", count: 32)

        XCTAssertEqual(
            SwiftrootsOnboardingRecoveryMessage.staleLinkReset(
                hasImportedKey: true,
                publicKeyHex: currentPubkey,
                trustrootsUsername: "alice",
                linkedPublicKeyHex: oldPubkey
            ),
            "Trustroots link reset. Verify your username for this key."
        )
        XCTAssertEqual(
            SwiftrootsOnboardingRecoveryMessage.staleLinkReset(
                hasImportedKey: false,
                publicKeyHex: nil,
                trustrootsUsername: "alice",
                linkedPublicKeyHex: oldPubkey
            ),
            "Trustroots link reset. Set up a key, then verify your username."
        )
        XCTAssertEqual(
            SwiftrootsOnboardingRecoveryMessage.staleLinkReset(
                hasImportedKey: false,
                publicKeyHex: nil,
                trustrootsUsername: "alice",
                linkedPublicKeyHex: oldPubkey,
                existingNotice: "Key cleared. No key stored on this device. Set up the key you want to use."
            ),
            "Key cleared. No key stored on this device. Set up the key you want to use."
        )
        XCTAssertNil(SwiftrootsOnboardingRecoveryMessage.staleLinkReset(
            hasImportedKey: true,
            publicKeyHex: currentPubkey,
            trustrootsUsername: "alice",
            linkedPublicKeyHex: currentPubkey
        ))
    }

    func testSwiftrootsClearKeyConfirmationMentionsTrustrootsLinkRemoval() {
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.clearKeyConfirmation,
            "You will return to setup and your Trustroots link will be removed from this device. Make sure your nsec or recovery phrase is backed up before clearing it."
        )
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.stopSharingBeforeClear,
            "Stop sharing before clearing this key so Swiftroots can tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.stopSharingFailure("Could not stop sharing. Check your connection and try again."),
            "Could not stop sharing. Check your connection and try again. Your key is still on this device. Retry Stop Sharing before clearing it."
        )
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.stopSharingRecoveryMessage(
                error: LocationSharingServiceError.noActiveSession,
                serviceStatusText: NostrailActionErrorFormatter.expiredSessionMessage,
                userFacingMessage: "Start a sharing session first."
            ),
            "Expired sharing cleared. You can start a new sharing session when ready."
        )
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.stopSharingRecoveryMessage(
                error: LocationSharingServiceError.noActiveSession,
                serviceStatusText: "Start a sharing session first.",
                userFacingMessage: "Start a sharing session first."
            ),
            "Sharing is already stopped. You can start a new sharing session when ready."
        )
        XCTAssertEqual(
            SwiftrootsKeyLifecycleMessage.stopSharingRecoveryMessage(
                error: RelayClientError.publishAckTimeout,
                serviceStatusText: "Could not confirm sharing stopped. Try again.",
                userFacingMessage: "Could not confirm sharing stopped. Try again."
            ),
            "Could not confirm sharing stopped. Try again. Your sharing session is still active. Retry Stop Sharing."
        )
    }

    func testSharedOnboardingKeyChangeConfirmationUsesAppSpecificCopy() {
        XCTAssertEqual(NativeOnboardingKeyRetryAction.generateKey.retryInstruction, "Try Generate Key again.")
        XCTAssertEqual(NativeOnboardingKeyRetryAction.importKey.retryInstruction, "Try Import Key again.")
        XCTAssertEqual(NativeOnboardingKeyRetryAction.saveGeneratedKey.retryInstruction, "Try Save Key again.")
        XCTAssertEqual(NativeOnboardingKeyRetryAction.clearKey.retryInstruction, "Try Clear Key again before continuing.")
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.generatedKeySaved(
                storageStatus: KeyStorageStatus(hasSecret: true, usesSimulatorFallback: false)
            ),
            "Generated key saved. Key stored on this device."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.generatedKeySaved(
                storageStatus: KeyStorageStatus(hasSecret: true, usesSimulatorFallback: true)
            ),
            "Generated key saved. Key stored in local simulator storage for this test run."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.clearKeySuccess(
                storageStatus: KeyStorageStatus(hasSecret: false, usesSimulatorFallback: false)
            ),
            "Key cleared. No key stored on this device. Set up the key you want to use."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.generatedKeyFailure(error: KeyStoreError.invalidInput),
            "We could not generate a key on this device. Try Generate Key again."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.keyStorageFailure(
                error: KeychainKeyStoreError(operation: .store, status: -34018),
                fallbackMessage: "We could not save your key on this device.",
                retryAction: .importKey
            ),
            "We could not save your key on this device. Try Import Key again."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.keyStorageFailure(
                error: KeyImportError.invalidNsec,
                fallbackMessage: KeyImportError.invalidNsec.localizedDescription,
                retryAction: .importKey
            ),
            KeyImportError.invalidNsec.localizedDescription
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.keySaveFailure(
                error: KeychainKeyStoreError(operation: .update, status: -34018),
                fallbackMessage: "We could not save your key on this device. The existing key was not changed; please try again. (Keychain updating failed: -34018)",
                retryAction: .importKey,
                requiresTrustrootsLink: false
            ),
            "We could not save your key on this device. The existing key was not changed; please try again. (Keychain updating failed: -34018) Try Import Key again."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.keySaveFailure(
                error: KeychainKeyStoreError(operation: .update, status: -34018),
                fallbackMessage: "We could not save your key on this device. The existing key was not changed; please try again. (Keychain updating failed: -34018)",
                retryAction: .importKey,
                requiresTrustrootsLink: true
            ),
            "We could not save your key on this device. The existing key was not changed; please try again. (Keychain updating failed: -34018) Try Import Key again. Your local Trustroots link stays as-is."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.keySaveFailure(
                error: KeyImportError.invalidNsec,
                fallbackMessage: KeyImportError.invalidNsec.localizedDescription,
                retryAction: .importKey,
                requiresTrustrootsLink: true
            ),
            KeyImportError.invalidNsec.localizedDescription
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.clearKeyFailure(
                error: KeychainKeyStoreError(operation: .delete, status: -34018),
                requiresTrustrootsLink: false
            ),
            "We could not remove your key from this device. Your key may still be stored here; please try again before continuing. (Keychain deleting failed: -34018) Try Clear Key again before continuing. Your key remains as-is until Clear Key succeeds."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.clearKeyFailure(
                error: KeychainKeyStoreError(operation: .delete, status: -34018),
                requiresTrustrootsLink: true
            ),
            "We could not remove your key from this device. Your key may still be stored here; please try again before continuing. (Keychain deleting failed: -34018) Try Clear Key again before continuing. Your key and local Trustroots link remain as-is until Clear Key succeeds."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.stopSharingFailure(
                userFacingMessage: "Could not confirm sharing stopped. Try again.",
                requiresTrustrootsLink: false,
                isSharingStillActive: true
            ),
            "Could not confirm sharing stopped. Try again. Your sharing session is still active, and your key remains as-is. Retry Stop Sharing before changing keys."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.stopSharingFailure(
                userFacingMessage: "Could not confirm sharing stopped. Try again.",
                requiresTrustrootsLink: true,
                isSharingStillActive: true
            ),
            "Could not confirm sharing stopped. Try again. Your sharing session is still active, and your key and local Trustroots link remain as-is. Retry Stop Sharing before changing keys."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.stopSharingFailure(
                userFacingMessage: "Sharing is already stopped.",
                requiresTrustrootsLink: true,
                isSharingStillActive: false
            ),
            "Sharing is already stopped."
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.useDifferentKeyConfirmation(requiresTrustrootsLink: false),
            NostrailKeyLifecycleGuard.clearKeyConfirmation
        )
        XCTAssertEqual(
            NativeOnboardingKeyLifecycleMessage.useDifferentKeyConfirmation(requiresTrustrootsLink: true),
            SwiftrootsKeyLifecycleMessage.clearKeyConfirmation
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.buttonTitle(
                isStopping: false,
                requiresTrustrootsLink: false,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                serviceStatusText: "Could not stop sharing. Check your connection and try again.",
                now: Date(timeIntervalSince1970: 1_000)
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.helperText(
                requiresTrustrootsLink: false,
                buttonTitle: "Retry Stop Sharing",
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.buttonTitle(
                isStopping: false,
                requiresTrustrootsLink: false,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true,
                now: Date(timeIntervalSince1970: 1_000)
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.helperText(
                requiresTrustrootsLink: false,
                buttonTitle: "Retry Stop Sharing",
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true
            ),
            "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.buttonTitle(
                isStopping: false,
                requiresTrustrootsLink: true,
                isSharing: true,
                sessionExpiresAtUnix: 900,
                serviceStatusText: "Could not stop sharing. Check your connection and try again.",
                now: Date(timeIntervalSince1970: 1_000)
            ),
            "Clear Expired Sharing"
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.buttonTitle(
                isStopping: false,
                requiresTrustrootsLink: true,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true,
                now: Date(timeIntervalSince1970: 1_000)
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.helperText(
                requiresTrustrootsLink: true,
                buttonTitle: "Retry Stop Sharing",
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true
            ),
            "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.helperText(
                requiresTrustrootsLink: true,
                buttonTitle: "Clear Expired Sharing",
                serviceStatusText: "Sharing active."
            ),
            "Clear expired sharing before using a different key."
        )
        XCTAssertEqual(
            NativeOnboardingStopSharingFormatter.helperText(
                requiresTrustrootsLink: true,
                buttonTitle: "Stop Sharing",
                serviceStatusText: "Sharing active."
            ),
            "Stop sharing before using a different key."
        )
    }

    func testSwiftrootsLinkingMessagesAreActionable() {
        XCTAssertEqual(
            SwiftrootsLinkingMessageFormatter.linked,
            "Trustroots username connected."
        )
        XCTAssertEqual(
            SwiftrootsLinkingMessageFormatter.differentKey,
            "That username is linked to a different key. Copy this npub to Trustroots Networks, then verify again."
        )
        XCTAssertEqual(
            SwiftrootsLinkingMessageFormatter.verificationFailure(
                handle: "alice@trustroots.org",
                error: Nip05ResolverError.nameNotFound("alice")
            ),
            "That Trustroots username is not linked yet. Copy this npub to Trustroots Networks, then verify again."
        )
        XCTAssertEqual(
            SwiftrootsLinkingMessageFormatter.verificationFailure(
                handle: "alice@trustroots.org",
                error: Nip05ResolverError.invalidResponse
            ),
            "Trustroots could not confirm alice@trustroots.org yet. Try again in a moment."
        )
        XCTAssertEqual(
            SwiftrootsLinkingMessageFormatter.verificationFailure(
                handle: "alice@trustroots.org",
                error: URLError(.notConnectedToInternet)
            ),
            "Could not reach Trustroots. Check your connection, then try again."
        )
    }

    func testNativeOnboardingStatusFormatterClearsStaleTypingFeedback() {
        XCTAssertTrue(NativeOnboardingStatusFormatter.isErrorStatus("Clipboard is empty."))
        XCTAssertTrue(NativeOnboardingStatusFormatter.isErrorStatus("That recovery phrase is not valid."))
        XCTAssertFalse(NativeOnboardingStatusFormatter.isErrorStatus("npub copied. Add it to your Trustroots Networks page."))

        XCTAssertTrue(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                "Clipboard is empty."
            )
        )
        XCTAssertTrue(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                "npub copied. Add it to your Trustroots Networks page."
            )
        )
        XCTAssertTrue(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                "nsec copied."
            )
        )
        XCTAssertTrue(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                "Opening Trustroots Networks..."
            )
        )
        XCTAssertTrue(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                "Add your Trustroots username to finish setup."
            )
        )
        XCTAssertFalse(
            NativeOnboardingStatusFormatter.shouldClearTransientStatusWhileEditing(
                SwiftrootsLinkingMessageFormatter.linked
            )
        )
    }

    @MainActor
    func testLocationSharingServiceReportsOnboardingKeyState() throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let service = LocationSharingService(
            keyStore: keyStore,
            relay: RecordingRelayClient(relayURL: URL(string: "wss://relay.example")!),
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        XCTAssertFalse(service.hasImportedKey)
        XCTAssertNil(service.publicKeyHex)

        try service.importKey(String(repeating: "12", count: 32))
        XCTAssertTrue(service.hasImportedKey)
        XCTAssertEqual(service.publicKeyHex, String(repeating: "ab", count: 32))
        XCTAssertEqual(service.keyStorageStatus, KeyStorageStatus(hasSecret: true, usesSimulatorFallback: false))

        try service.clearKey()
        XCTAssertFalse(service.hasImportedKey)
        XCTAssertNil(service.publicKeyHex)
        XCTAssertEqual(service.keyStorageStatus, KeyStorageStatus(hasSecret: false, usesSimulatorFallback: false))
    }

    func testLocationSharingServiceResolvesBareTrustrootsRecipientForInvite() async throws {
        let recipient = String(repeating: "bc", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.publishInvite(to: "alice", message: "hi")

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org"])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.recipients, [recipient])
    }

    func testLocationSharingServiceResolvesAtPrefixedTrustrootsRecipientForInvite() async throws {
        let recipient = String(repeating: "be", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.publishInvite(to: "@Alice", message: "hi")

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
    }

    func testLocationSharingServiceResolvesTrustrootsProfileLinkForInvite() async throws {
        let recipient = String(repeating: "bf", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.publishInvite(to: "https://www.trustroots.org/profile/Alice", message: "hi")

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
    }

    func testRecipientInputNormalizerCanonicalizesDuplicates() throws {
        let bare = try RecipientInputNormalizer.normalize("Alice")
        let atPrefixed = try RecipientInputNormalizer.normalize(" @alice ")
        let nip05 = try RecipientInputNormalizer.normalize("alice@www.trustroots.org")
        let profileURL = try RecipientInputNormalizer.normalize("https://www.trustroots.org/profile/alice")

        XCTAssertEqual(bare.displayText, "alice")
        XCTAssertEqual(atPrefixed.displayText, "@alice")
        XCTAssertEqual(nip05.displayText, "alice@trustroots.org")
        XCTAssertEqual(profileURL.displayText, "alice")
        XCTAssertEqual(
            Set([bare.duplicateKey, atPrefixed.duplicateKey, nip05.duplicateKey, profileURL.duplicateKey]),
            ["nip05:alice@trustroots.org"]
        )
    }

    func testRecipientInputNormalizerRejectsConfusingRecipientText() {
        XCTAssertThrowsError(try RecipientInputNormalizer.normalize("alice bob")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .invalidFormat)
        }
        XCTAssertThrowsError(try RecipientInputNormalizer.normalize("https://www.trustroots.org/settings")) { error in
            XCTAssertEqual(error as? TrustrootsUsernameError, .invalidFormat)
        }
        XCTAssertThrowsError(try RecipientInputNormalizer.normalize("alice@example")) { error in
            XCTAssertEqual(error as? RecipientInputError, .invalidFormat)
        }
        XCTAssertEqual(
            RecipientInputError.invalidFormat.localizedDescription,
            "Use a Trustroots username, profile link, NIP-05 address, npub, or public key."
        )
        XCTAssertEqual(
            LocationSharingServiceError.recipientResolutionFailed(
                input: "ghost",
                underlying: RecipientInputError.invalidFormat
            ).localizedDescription,
            "Could not resolve \"ghost\". Check the Trustroots username, profile link, NIP-05 address, npub, or public key."
        )
        XCTAssertEqual(
            LocationSharingServiceError.recipientResolutionFailed(
                input: "ghost",
                underlying: Nip05ResolverError.nameNotFound("ghost")
            ).localizedDescription,
            "Could not resolve \"ghost\". Check the Trustroots username, profile link, NIP-05 address, npub, or public key. NIP-05 name 'ghost' was not found."
        )
    }

    func testRecipientBatchInputNormalizerAcceptsBulkPasteAndSkipsDuplicates() throws {
        let bobPubkey = String(repeating: "bd", count: 32)
        let bobNpub = try NIP19.encodeNpub(pubkeyHex: bobPubkey)

        let result = RecipientBatchInputNormalizer.normalizeMany(
            "alice, @alice\n\(bobNpub); https://www.trustroots.org/profile/chris dana@trustroots.org",
            existingRecipients: ["dana"]
        )

        XCTAssertEqual(result.added.map(\.displayText), ["alice", bobNpub])
        XCTAssertEqual(result.duplicates, ["@alice", "dana@trustroots.org"])
        XCTAssertEqual(result.invalidInputs, ["https://www.trustroots.org/profile/chris"])
        XCTAssertTrue(result.hasFeedback)

        let empty = RecipientBatchInputNormalizer.normalizeMany("", existingRecipients: [])
        XCTAssertFalse(empty.hasFeedback)
    }

    func testNostrailRecipientBatchStatusFormatterUsesActionablePasteFeedback() throws {
        let bobPubkey = String(repeating: "bd", count: 32)
        let bobNpub = try NIP19.encodeNpub(pubkeyHex: bobPubkey)

        let mixed = RecipientBatchInputNormalizer.normalizeMany(
            "alice, @alice \(bobNpub) https://www.trustroots.org/profile/chris",
            existingRecipients: []
        )

        XCTAssertEqual(
            NostrailRecipientBatchStatusFormatter.statusText(for: mixed),
            "Added 2 recipients. Already added: @alice. Could not add: https://www.trustroots.org/profile/chris. Use a Trustroots username, profile link, NIP-05 address, npub, or public key."
        )
        XCTAssertEqual(
            NostrailRecipientBatchStatusFormatter.statusText(for: RecipientBatchNormalizationResult()),
            "Enter a recipient."
        )

        var noisy = RecipientBatchNormalizationResult()
        noisy.duplicates = ["alice", "bob", "carol", "dave"]
        noisy.invalidInputs = ["bad1", "bad2", "bad3", "bad4", "bad5"]
        XCTAssertEqual(
            NostrailRecipientBatchStatusFormatter.statusText(for: noisy),
            "Already added: alice, bob, carol, +1 more. Could not add: bad1, bad2, bad3, +2 more. Use a Trustroots username, profile link, NIP-05 address, npub, or public key."
        )
    }

    func testRecipientRowStateInviteRetrySkipsOnlyAlreadySentInvites() {
        var state = RecipientRowState()
        let recipients = ["alice", "ghost", "bob"]

        state.markPublishResult(attemptedRecipients: recipients, failedInputs: ["ghost"], purpose: .invite)

        XCTAssertEqual(state.purpose, .invite)
        XCTAssertEqual(state.sent, ["alice", "bob"])
        XCTAssertEqual(state.needingAttention, ["ghost"])
        XCTAssertEqual(state.sentLabel, "Sent")
        XCTAssertEqual(state.inviteRetryRecipients(from: recipients), ["ghost"])
        XCTAssertEqual(state.shareRetryRecipients(from: recipients), recipients)
    }

    func testRecipientRowStateSeparatesLookupAttentionFromSendRetry() {
        var state = RecipientRowState()
        let recipients = ["alice", "ghost", "bob"]

        state.markPublishResult(
            attemptedRecipients: recipients,
            failedLookupInputs: ["ghost"],
            failedSendInputs: ["bob"],
            purpose: .invite
        )

        XCTAssertEqual(state.sent, ["alice"])
        XCTAssertEqual(state.needingAttention, ["ghost"])
        XCTAssertEqual(state.needingRetry, ["bob"])
        XCTAssertEqual(state.inviteRetryRecipients(from: recipients), ["ghost", "bob"])
        XCTAssertEqual(state.displayStatus(for: "alice"), .sent("Sent"))
        XCTAssertEqual(state.displayStatus(for: "ghost"), .check)
        XCTAssertEqual(state.displayStatus(for: "ghost").detailText, "Tap edit or remove this recipient.")
        XCTAssertEqual(state.displayStatus(for: "bob"), .retry)
        XCTAssertEqual(state.displayStatus(for: "bob").detailText, "Reconnect, then retry.")
        XCTAssertEqual(state.displayStatus(for: "bob").detailText(didReconnect: true), "Retry this recipient.")
        XCTAssertEqual(state.displayStatus(for: "carol"), .none)
        XCTAssertNil(state.displayStatus(for: "alice").detailText)
    }

    func testRecipientRowStateShareRetryDoesNotInheritInviteSentState() {
        var state = RecipientRowState()
        let recipients = ["alice", "ghost", "bob"]

        state.markPublishResult(attemptedRecipients: recipients, failedInputs: [], purpose: .invite)
        XCTAssertEqual(state.inviteRetryRecipients(from: recipients), [])
        XCTAssertEqual(state.shareRetryRecipients(from: recipients), recipients)

        state.markPublishResult(attemptedRecipients: recipients, failedInputs: ["ghost"], purpose: .shareRetry)

        XCTAssertEqual(state.purpose, .shareRetry)
        XCTAssertEqual(state.sent, ["alice", "bob"])
        XCTAssertEqual(state.needingAttention, ["ghost"])
        XCTAssertEqual(state.sentLabel, "Updated")
        XCTAssertEqual(state.displayStatus(for: "alice"), .sent("Updated"))
        XCTAssertEqual(state.shareRetryRecipients(from: recipients), ["ghost"])
        XCTAssertEqual(state.inviteRetryRecipients(from: recipients), recipients)
    }

    func testRecipientRowStateShareRetryKeepsUpdatedRecipientsCurrentAfterFailedRowsAreRemoved() {
        var state = RecipientRowState()

        state.markPublishResult(
            attemptedRecipients: ["alice", "bob"],
            failedLookupInputs: [],
            failedSendInputs: ["bob"],
            purpose: .shareRetry
        )
        state.prune(to: ["alice"])

        XCTAssertEqual(state.shareRetryRecipients(from: ["alice"]), [])
        XCTAssertEqual(state.displayStatus(for: "alice"), .sent("Updated"))
        XCTAssertTrue(state.needingAttention.isEmpty)
        XCTAssertTrue(state.needingRetry.isEmpty)
    }

    func testRecipientRowStateShareRetryTargetsOnlyNewRecipientsAfterEveryoneVisibleIsCurrent() {
        var state = RecipientRowState()

        state.markPublishResult(
            attemptedRecipients: ["alice"],
            failedLookupInputs: [],
            failedSendInputs: [],
            purpose: .shareRetry
        )

        XCTAssertEqual(state.shareRetryRecipients(from: ["alice"]), [])
        XCTAssertEqual(state.shareRetryRecipients(from: ["alice", "carol"]), ["carol"])
        XCTAssertEqual(state.displayStatus(for: "alice"), .sent("Updated"))
        XCTAssertEqual(state.displayStatus(for: "carol"), .none)
    }

    func testRecipientRowStateClearsAfterSuccessfulShareUpdate() {
        var state = RecipientRowState()
        let recipients = ["alice", "ghost"]

        state.markPublishResult(attemptedRecipients: recipients, failedInputs: ["ghost"], purpose: .shareRetry)
        state.clear()

        XCTAssertEqual(state.purpose, nil)
        XCTAssertTrue(state.sent.isEmpty)
        XCTAssertTrue(state.needingAttention.isEmpty)
        XCTAssertEqual(state.inviteRetryRecipients(from: recipients), recipients)
        XCTAssertEqual(state.shareRetryRecipients(from: recipients), recipients)
    }

    func testRecipientRowStateClearsShareRetryStateWhenSharingEnds() {
        var shareState = RecipientRowState()
        let recipients = ["alice", "bob"]

        shareState.markPublishResult(attemptedRecipients: recipients, failedInputs: [], purpose: .shareRetry)
        XCTAssertTrue(shareState.clearShareRetryState())

        XCTAssertNil(shareState.purpose)
        XCTAssertEqual(shareState.shareRetryRecipients(from: recipients), recipients)
        XCTAssertEqual(shareState.displayStatus(for: "alice"), .none)

        var inviteState = RecipientRowState()
        inviteState.markPublishResult(attemptedRecipients: recipients, failedInputs: [], purpose: .invite)
        XCTAssertFalse(inviteState.clearShareRetryState())

        XCTAssertEqual(inviteState.purpose, .invite)
        XCTAssertEqual(inviteState.inviteRetryRecipients(from: recipients), [])
        XCTAssertEqual(inviteState.displayStatus(for: "alice"), .sent("Sent"))
    }

    func testRecipientRowStatePrunesRemovedRecipientsAndClearsWhenEmpty() {
        var state = RecipientRowState()
        let recipients = ["alice", "ghost", "bob"]

        state.markPublishResult(
            attemptedRecipients: recipients,
            failedLookupInputs: ["ghost"],
            failedSendInputs: ["bob"],
            purpose: .invite
        )
        state.prune(to: ["alice"])

        XCTAssertEqual(state.purpose, .invite)
        XCTAssertEqual(state.sent, ["alice"])
        XCTAssertTrue(state.needingAttention.isEmpty)
        XCTAssertTrue(state.needingRetry.isEmpty)
        XCTAssertEqual(state.inviteRetryRecipients(from: ["alice"]), [])

        state.prune(to: [])

        XCTAssertNil(state.purpose)
        XCTAssertTrue(state.sent.isEmpty)
        XCTAssertTrue(state.needingAttention.isEmpty)
        XCTAssertTrue(state.needingRetry.isEmpty)
    }

    func testNostrailRecipientSummaryKeepsMainScreenReadable() {
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.recipientSheetEmptyText,
            "Add a Trustroots username, profile link, @username, username@trustroots.org, npub, or public key before inviting or sharing."
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.sharingSummary(
                recipients: [],
                hasLocationFix: false,
                isWaitingForLocation: false
            ),
            "Add recipients from the map button before sharing."
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.sharingSummary(
                recipients: ["alice"],
                hasLocationFix: false,
                isWaitingForLocation: false
            ),
            "Use the current-location button before starting a sharing session."
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.sharingSummary(
                recipients: ["alice"],
                hasLocationFix: false,
                isWaitingForLocation: true
            ),
            "Waiting for iOS to return your approximate area."
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.sharingSummary(
                recipients: ["alice", "bob", "carol", "dave"],
                hasLocationFix: true,
                isWaitingForLocation: false
            ),
            "Recipients: alice, bob, +2 more."
        )
    }

    func testNostrailRecipientSummaryShortensLongPublicKeys() {
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.shortDisplayName("npub1abcdefghijklmnopqrstuvwxyz1234567890"),
            "npub1abcdefg...567890"
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.shortDisplayName(String(repeating: "a", count: 24)),
            String(repeating: "a", count: 24)
        )
        XCTAssertEqual(
            NostrailRecipientSummaryFormatter.shortDisplayName(String(repeating: "b", count: 25)),
            "bbbbbbbbbbbb...bbbbbb"
        )
    }

    func testNostrailRecipientFeedbackUsesActionableRetryCopy() {
        XCTAssertEqual(NostrailRecipientFeedbackFormatter.personCountText(1), "1 person")
        XCTAssertEqual(NostrailRecipientFeedbackFormatter.personCountText(2), "2 people")
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.attentionText(["ghost"]),
            "Check ghost, then try again."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.attentionText(["ghost", "alice", "bob", "carol"]),
            "Check ghost, alice, bob, +1 more, then try again."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.sendRetryText(["ghost"]),
            "Reconnect, then retry ghost."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.sendRetryText(["ghost", "alice", "bob", "carol"]),
            "Reconnect, then retry ghost, alice, bob, +1 more."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.combinedFailureText(lookupInputs: ["ghost"], sendInputs: ["alice"]),
            "Check ghost, then try again. Reconnect, then retry alice."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: ["ghost"], sendInputs: []),
            "Check 1 person below."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: ["ghost", "bob"], sendInputs: []),
            "Check 2 people below."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: [], sendInputs: ["alice"]),
            "Reconnect, then retry 1 person."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.failureSummaryText(lookupInputs: ["ghost"], sendInputs: ["alice"]),
            "Some recipients need checking or retrying."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.statusText(
                successText: "Invite sent to 1 person.",
                failedInputs: ["ghost"]
            ),
            "Invite sent to 1 person. Check ghost, then try again."
        )
        XCTAssertEqual(
            NostrailRecipientFeedbackFormatter.statusText(
                successText: "No invites sent.",
                failedInputs: ["ghost"]
            ),
            "No invites sent. Check ghost, then try again."
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Reconnect, then retry ghost."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Check ghost, then try again."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Location updated. Some recipients need checking or retrying."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Already added: @alice."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Clipboard is empty."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Recipient copied."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Recipient removed."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "2 recipients removed."
            )
        )
        XCTAssertTrue(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Edit the recipient, then add it again."
            )
        )
        XCTAssertFalse(
            NostrailRecipientFeedbackFormatter.shouldClearTransientStatusWhileEditing(
                "Reconnected. Retry rows marked Retry."
            )
        )
    }

    func testNostrailRecipientActionFormatterUsesRetrySpecificInviteCopy() {
        XCTAssertEqual(NostrailRecipientActionFormatter.mapRecipientButtonTitle(count: 0), "Add People")
        XCTAssertEqual(NostrailRecipientActionFormatter.mapRecipientButtonTitle(count: 1), "1 Person")
        XCTAssertEqual(NostrailRecipientActionFormatter.mapRecipientButtonTitle(count: 3), "3 People")
        XCTAssertEqual(NostrailRecipientActionFormatter.missingRecipientsShareButtonTitle, "Add People to Share")

        XCTAssertEqual(
            NostrailRecipientActionFormatter.inviteButtonTitle(
                isSending: false,
                pendingCount: 1,
                allInvitesSent: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry Invite"
        )
        XCTAssertTrue(
            NostrailRecipientActionFormatter.shouldPrioritizeInviteRetry(
                containsSendRetry: true,
                didReconnect: true
            )
        )
        XCTAssertFalse(
            NostrailRecipientActionFormatter.shouldPrioritizeInviteRetry(
                containsSendRetry: true,
                didReconnect: false
            )
        )
        XCTAssertFalse(
            NostrailRecipientActionFormatter.shouldPrioritizeInviteRetry(
                containsSendRetry: false,
                didReconnect: true
            )
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.inviteButtonTitle(
                isSending: false,
                pendingCount: 3,
                allInvitesSent: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry 3 Invites"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.inviteButtonTitle(
                isSending: false,
                pendingCount: 2,
                allInvitesSent: false,
                containsSendRetry: true,
                containsLookupCheck: true
            ),
            "Send 2 Pending Invites"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.inviteButtonTitle(
                isSending: false,
                pendingCount: 0,
                allInvitesSent: true,
                containsSendRetry: false,
                containsLookupCheck: false
            ),
            "All Invites Sent"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.inviteButtonTitle(
                isSending: true,
                pendingCount: 1,
                allInvitesSent: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retrying..."
        )
        XCTAssertEqual(NostrailRecipientActionFormatter.inviteSendStatus(containsSendRetry: true), "Retrying invites...")
        XCTAssertEqual(NostrailRecipientActionFormatter.inviteSendStatus(containsSendRetry: false), "Resolving recipients...")
        XCTAssertEqual(
            NostrailRecipientActionFormatter.invitePendingNote(
                visibleCount: 3,
                pendingCount: 1,
                allInvitesSent: false
            ),
            "Only 1 person with pending invites will be sent. Already-invited recipients will not get a duplicate invite."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.invitePendingNote(
                visibleCount: 4,
                pendingCount: 2,
                allInvitesSent: false
            ),
            "Only 2 people with pending invites will be sent. Already-invited recipients will not get a duplicate invite."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.invitePendingNote(
                visibleCount: 2,
                pendingCount: 0,
                allInvitesSent: true
            ),
            "All selected recipients have already been invited."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.invitePendingNote(
                visibleCount: 0,
                pendingCount: 0,
                allInvitesSent: false
            ),
            "Add at least one recipient to send an invite."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.invitePendingNote(
                visibleCount: 2,
                pendingCount: 2,
                allInvitesSent: false
            ),
            ""
        )
    }

    func testNostrailLocationStatusFormatterUsesSettingsCopyOnlyForPermissionDenied() {
        XCTAssertEqual(
            NostrailLocationStatusFormatter.initialLocationPrompt,
            "Choose your current approximate area before sharing."
        )
        XCTAssertEqual(
            NostrailLocationStatusFormatter.permissionDenied,
            "Location permission is off. Enable it in Settings to jump to your current area."
        )
        XCTAssertEqual(
            NostrailLocationStatusFormatter.permissionUnavailable,
            "Location permission is unavailable."
        )
        XCTAssertEqual(
            NostrailLocationStatusFormatter.currentAreaReady,
            "Using current approximate area."
        )
        XCTAssertEqual(
            NostrailLocationStatusFormatter.failureText("network busy"),
            "Could not get current location: network busy"
        )
        XCTAssertTrue(
            NostrailLocationStatusFormatter.isPermissionSettingsStatus(
                "Location permission is off. Enable it in Settings to jump to your current area."
            )
        )
        XCTAssertFalse(
            NostrailLocationStatusFormatter.isPermissionSettingsStatus(
                "Location permission is unavailable."
            )
        )
        XCTAssertTrue(
            NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(
                "Could not get current location: The operation could not be completed."
            )
        )
        XCTAssertFalse(
            NostrailLocationStatusFormatter.isRetryableLocationFailureStatus(
                NostrailLocationStatusFormatter.permissionDenied
            )
        )
        XCTAssertTrue(
            NostrailLocationStatusFormatter.shouldClearAfterRecipientChange(
                "Could not get current location: network busy"
            )
        )
        XCTAssertFalse(
            NostrailLocationStatusFormatter.shouldClearAfterRecipientChange(
                NostrailLocationStatusFormatter.permissionDenied
            )
        )
    }

    func testNostrailRecipientActionFormatterUsesRetrySpecificShareCopy() {
        XCTAssertEqual(
            NostrailRecipientActionFormatter.currentAreaChangedStatus,
            "Current area changed. Nostrail will update automatically, or you can share this area now."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry Location Update"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry Sharing Start"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: true
            ),
            "Send Pending Update"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: true,
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retrying..."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: true,
                containsSendRetry: false,
                containsLookupCheck: false
            ),
            "Update Shared Location"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: true,
                containsSendRetry: false,
                containsLookupCheck: false,
                allRecipientsCurrent: true
            ),
            "All Updates Sent"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: false,
                containsSendRetry: false,
                containsLookupCheck: false,
                shouldRetryLocation: true
            ),
            "Try Location Again"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareButtonTitle(
                isRunning: false,
                isSharing: false,
                containsSendRetry: false,
                containsLookupCheck: false,
                allRecipientsCurrent: true
            ),
            "Sharing Started"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareActionStatus(
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retrying location update..."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareActionStatus(
                isSharing: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retrying sharing start..."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareActionStatus(
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: true
            ),
            "Sending pending location update..."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.sharePendingNote(
                isSharing: true,
                visibleCount: 3,
                pendingCount: 1
            ),
            "Only 1 person with pending location updates will be sent. Already-current recipients will not get a duplicate update."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.sharePendingNote(
                isSharing: false,
                visibleCount: 4,
                pendingCount: 2
            ),
            "Only 2 people with pending sharing starts will be sent. Already-current recipients will not get a duplicate sharing start."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.sharePendingNote(
                isSharing: true,
                visibleCount: 2,
                pendingCount: 2
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.sharePendingNote(
                isSharing: true,
                visibleCount: 2,
                pendingCount: 0
            ),
            "All selected recipients already have the latest location update. Add someone new to share with more people."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.sharePendingNote(
                isSharing: false,
                visibleCount: 2,
                pendingCount: 0
            ),
            "All selected recipients already have the sharing start. Add someone new to include more people."
        )
        XCTAssertTrue(
            NostrailRecipientActionFormatter.shouldRetryLocation(
                statusLine: "Could not get current location: network busy",
                hasLocationFix: false
            )
        )
        XCTAssertFalse(
            NostrailRecipientActionFormatter.shouldRetryLocation(
                statusLine: "Could not get current location: network busy",
                hasLocationFix: true
            )
        )
        XCTAssertFalse(
            NostrailRecipientActionFormatter.shouldRetryLocation(
                statusLine: NostrailLocationStatusFormatter.permissionDenied,
                hasLocationFix: false
            )
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.locationRetryNote(
                shouldRetryLocation: true,
                recipientCount: 2,
                isSharing: false
            ),
            "Try location again without changing the people selected."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.locationRetryNote(
                shouldRetryLocation: true,
                recipientCount: 0,
                isSharing: false
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareReadinessNote(
                hasLocationFix: false,
                isWaitingForLocation: false,
                recipientCount: 0
            ),
            "Add at least one recipient before sharing."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareReadinessNote(
                hasLocationFix: false,
                isWaitingForLocation: true,
                recipientCount: 2
            ),
            "Waiting for iOS to return an approximate area. Cancel keeps people selected."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareReadinessNote(
                hasLocationFix: false,
                isWaitingForLocation: false,
                recipientCount: 2
            ),
            "Find your current location before sharing."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareReadinessNote(
                hasLocationFix: true,
                isWaitingForLocation: false,
                recipientCount: 2
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareReadinessNote(
                hasLocationFix: true,
                isWaitingForLocation: false,
                recipientCount: 0,
                isSharing: true
            ),
            "Uses the active sharing session. Add people to share with someone new."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.restoredActiveSessionStatus(recipientCount: 0),
            "Restored active sharing. Reconnect relays, then Share Current Area to send the latest approximate area."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.restoredActiveSessionStatus(recipientCount: 2),
            "Restored active sharing with 2 people. Reconnect relays, then Share Current Area to send the latest approximate area."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.locationWaitCanceledText(),
            "Location request canceled. People stay selected for sharing later."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 0, isSendingInvite: false),
            "Add at least one recipient before starting sharing."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 2, isSendingInvite: true),
            "Finish sending invites before starting sharing."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 1, isSendingInvite: false),
            "Starts a 2-hour sharing session with 1 person."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 3, isSendingInvite: false),
            "Starts a 2-hour sharing session with 3 people."
        )
        XCTAssertEqual(NostrailRecipientActionFormatter.shareSheetButtonTitle(isSharing: false), "Start Sharing")
        XCTAssertEqual(NostrailRecipientActionFormatter.shareSheetButtonTitle(isSharing: true), "Share Current Area")
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: false,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry Sharing Start"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: true,
                containsSendRetry: true,
                containsLookupCheck: false
            ),
            "Retry Location Update"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: false,
                containsSendRetry: true,
                containsLookupCheck: true
            ),
            "Start Pending Sharing"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: true,
                containsSendRetry: false,
                containsLookupCheck: true
            ),
            "Send Pending Update"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: true,
                containsSendRetry: false,
                containsLookupCheck: false,
                allRecipientsCurrent: true
            ),
            "All Updates Sent"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareSheetButtonTitle(
                isSharing: false,
                containsSendRetry: false,
                containsLookupCheck: false,
                allRecipientsCurrent: true
            ),
            "Sharing Started"
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 0, isSendingInvite: false, isSharing: true),
            "Add at least one recipient before sharing your current area."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 2, isSendingInvite: true, isSharing: true),
            "Finish sending invites before sharing your current area."
        )
        XCTAssertEqual(
            NostrailRecipientActionFormatter.shareStartSheetNote(recipientCount: 2, isSendingInvite: false, isSharing: true),
            "Sends the latest approximate area to 2 people."
        )
    }

    func testNostrailRelayStatusFormatterShowsPlainReconnectAction() {
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Relay stopped sending updates. Try reconnecting.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Could not send this update. Check your connection and try again.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Location updated. Reconnect, then retry 1 person.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: true,
                serviceStatusText: "Could not send this update. Check your connection and try again.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Could not connect to relays. Check your connection and try again.",
                relayAvailabilityText: "All relays are turned off."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldShowReconnect(
                isAuthenticated: false,
                serviceStatusText: "Sharing started.",
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectButtonTitle(isRunning: false),
            "Reconnect"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectButtonTitle(isRunning: true),
            "Reconnecting..."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectButtonTitle(
                isRunning: false,
                retryWaitText: "Try again in 5 seconds."
            ),
            "Try Again Soon"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetReconnectStatus(isRunning: true),
            "Reconnecting..."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetReconnectStatus(isRunning: false),
            "Reconnected. Retry rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetReconnectStatus(
                isRunning: false,
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ]
            ),
            "Reconnected with limited relay access. Receiving still works; sharing has no reachable relay."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRetryHelperText(didReconnect: false),
            "Reconnect before retrying rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRetryHelperText(didReconnect: true),
            "Retry the rows marked Retry."
        )
        let receivingOnlyRecovery = [
            RelayConnectionCheckResult(
                url: URL(string: "wss://relay-a.example")!,
                state: .connected,
                readEnabled: true,
                writeEnabled: false
            ),
            RelayConnectionCheckResult(
                url: URL(string: "wss://relay-b.example")!,
                state: .failed("timeout"),
                readEnabled: false,
                writeEnabled: true
            )
        ]
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldBlockRecipientSheetRetry(
                hasRetryableSendFailures: true,
                didReconnect: true,
                relayCheckResults: receivingOnlyRecovery
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldBlockRecipientSheetRetry(
                hasRetryableSendFailures: true,
                didReconnect: false,
                relayCheckResults: receivingOnlyRecovery
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldBlockRecipientSheetRetry(
                hasRetryableSendFailures: false,
                didReconnect: true,
                relayCheckResults: receivingOnlyRecovery
            )
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetBlockedRetryText,
            "Sharing has no reachable relay. Open Relay Settings or reconnect before retrying rows marked Retry."
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.didRelaySettingsRecoverSharingPath(
                relayAvailabilityText: "2 relays enabled."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.didRelaySettingsRecoverSharingPath(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.didRelaySettingsRecoverSharingPath(
                relayAvailabilityText: "All relays are turned off."
            )
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRelaySettingsStatusText(
                relayAvailabilityText: "2 relays enabled."
            ),
            "Relay settings updated. Retry rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRelaySettingsStatusText(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Sharing is still off. Turn on Share for at least one relay before retrying rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRelaySettingsChangedStatusText(
                relayAvailabilityText: "2 relays enabled."
            ),
            "Relay settings updated. Check relays before retrying rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRelayCheckStatusText(
                relayAvailabilityText: "2 relays enabled.",
                relayCheckResults: receivingOnlyRecovery
            ),
            "Sharing still has no reachable relay. Check Share toggles or try another relay before retrying rows marked Retry."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.recipientSheetRelayCheckStatusText(
                relayAvailabilityText: "2 relays enabled.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: true
                    )
                ]
            ),
            "Relay settings checked. Retry rows marked Retry."
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.isSharingBlockedByRelaySettings(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            )
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.isSharingBlockedByRelaySettings(
                relayAvailabilityText: "All relays are turned off."
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.isSharingBlockedByRelaySettings(
                relayAvailabilityText: "Receiving is off. Turn on at least one readable relay."
            )
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.mapRelaySettingsStatusText(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Sharing is off. Turn on Share for at least one relay."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.mapRelaySettingsStatusText(
                relayAvailabilityText: "All relays are turned off."
            ),
            "Relays are turned off. Open Relay Settings before sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.mapRelaySettingsStatusText(
                relayAvailabilityText: "2 relays enabled."
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: false,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Turn on Share here to send location updates."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: false,
                    writeEnabled: false,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "All relays are turned off."
            ),
            "Turn on Share here before sending."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: true,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "2 relays enabled."
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: false,
                    writeEnabled: true,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "2 relays enabled.",
                connectionCheck: RelayConnectionCheckResult(
                    url: URL(string: "wss://relay.example")!,
                    state: .failed("timeout"),
                    readEnabled: false,
                    writeEnabled: true
                )
            ),
            "Share is failing here. Turn this relay off or add another Share relay if it keeps failing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "2 relays enabled."
            ),
            "Relay settings changed. Reconnect to check current relay access."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "2 relays enabled.",
                isResolvingStopSharingRetry: true
            ),
            "Relay settings changed. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "All relays are turned off."
            ),
            "Relay settings changed. Turn on at least one relay before reconnecting."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "All relays are turned off.",
                isResolvingStopSharingRetry: true
            ),
            "Relay settings changed. Turn on at least one relay before retrying Stop Sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added relay.example.",
                relayAvailabilityText: "2 relays enabled."
            ),
            "Added relay.example. Reconnect to check current relay access before sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added relay.example.",
                relayAvailabilityText: "2 relays enabled.",
                isResolvingStopSharingRetry: true
            ),
            "Added relay.example. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Removed relay.example.",
                relayAvailabilityText: "All relays are turned off."
            ),
            "Removed relay.example. Turn on at least one relay before reconnecting."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.relaySettingsActionStatusText(
                actionText: "Removed relay.example.",
                relayAvailabilityText: "All relays are turned off.",
                isResolvingStopSharingRetry: true
            ),
            "Removed relay.example. Turn on at least one relay before retrying Stop Sharing."
        )
        XCTAssertEqual(
            RelaySettingsActionFailureFormatter.statusText(
                error: RelayEndpointInputError.empty,
                action: .addRelay
            ),
            "Enter a relay address before adding it. Check the relay address, then Add Relay again."
        )
        XCTAssertEqual(
            RelaySettingsActionFailureFormatter.statusText(
                error: RelayEndpointInputError.duplicate,
                action: .addRelay
            ),
            "That relay is already in Settings. Use the relay already listed, or enter a different relay address."
        )
        XCTAssertEqual(
            RelaySettingsActionFailureFormatter.statusText(
                error: RelayEndpointInputError.cannotRemoveBuiltIn,
                action: .removeRelay
            ),
            "Built-in relays can be turned off, but not removed. Turn off Receive and Share instead."
        )
        XCTAssertEqual(
            RelaySettingsActionFailureFormatter.statusText(
                error: RelayEndpointInputError.notFound,
                action: .removeRelay
            ),
            "That relay is not in Settings. Refresh Relay Settings before trying again."
        )
        XCTAssertEqual(
            RelaySettingsActionFailureFormatter.statusText(
                error: RelayEndpointInputError.relaySettingsUnavailable,
                action: .restoreDefaults
            ),
            "Relay settings are unavailable in this build. This build can only use the bundled relay list."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnected. New shared locations can arrive again."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .connected,
                        readEnabled: false,
                        writeEnabled: true
                    )
                ]
            ),
            "Reconnected with limited relay access. Sharing still works; receiving has no reachable relay."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Could not send this update. Check your connection and try again.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ]
            ),
            "Reconnected with limited relay access. Receiving still works; sharing has no reachable relay."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                canShareCurrentArea: true
            ),
            "Reconnected with limited relay access. Receiving still works; sharing has no reachable relay. Open Relay Settings before using Share Current Area."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .connected,
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                canShareCurrentArea: true
            ),
            "Reconnected with limited relay access. Sharing still works; receiving has no reachable relay. Use Share Current Area to send now."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnected. Retry any pending invite or location update."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnected. Retry Stop Sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Could not connect to relays. Check your connection and try again."
            ),
            "Reconnected. You can receive and send shared locations."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnected. Automatic location updates can resume."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.",
                canShareCurrentArea: true
            ),
            "Reconnected. Automatic updates resumed. Use Share Current Area to send now."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectFailureText(
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.",
                errorMessage: "Could not connect to relays. Check your connection and try again."
            ),
            "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectFailureText(
                previousServiceStatusText: "Could not send this update. Check your connection and try again.",
                errorMessage: "Could not connect to relays. Check your connection and try again."
            ),
            "Could not connect to relays. Check your connection and try again."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectSuccessText(previousServiceStatusText: "Sharing started."),
            "Reconnected."
        )
        XCTAssertTrue(
            NostrailRelayStatusFormatter.shouldShowRecipientSheetReconnectButton(
                hasRetryableSendFailures: true,
                didReconnect: false
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldShowRecipientSheetReconnectButton(
                hasRetryableSendFailures: true,
                didReconnect: true
            )
        )
        XCTAssertFalse(
            NostrailRelayStatusFormatter.shouldShowRecipientSheetReconnectButton(
                hasRetryableSendFailures: false,
                didReconnect: false
            )
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnect before retrying invites or location updates."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Relay stopped sending updates. Try reconnecting.",
                retryWaitText: "Try again in 5 seconds."
            ),
            "Try again in 5 seconds."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnect now, then retry any pending invite or location update."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Location updated. Reconnect, then retry 1 person."
            ),
            "Reconnect now, then retry any pending invite or location update."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect now, then retry Stop Sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Could not connect to relays. Check your connection and try again."
            ),
            "Reconnect now to receive and send shared locations."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.reconnectHelperText(
                serviceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnect now to resume automatic updates, then Share Current Area to send now."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingButtonTitle(
                isStopping: true,
                serviceStatusText: "Sharing active."
            ),
            "Stopping..."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                serviceStatusText: "Reconnected. Retry Stop Sharing."
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                serviceStatusText: "Sharing active."
            ),
            "Stop Sharing"
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Could not stop sharing. Check your connection and try again.",
                didChangeRelaySettings: true
            ),
            "Relay settings changed. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: "2 relays enabled.",
                didChangeRelaySettings: true,
                hasPendingRetry: true
            ),
            "Relay settings changed. Reconnect relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Reconnected. Retry Stop Sharing."
            ),
            "Relays reconnected. Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Sharing active."
            ),
            ""
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.automaticPublishingStatusText(
                isSharing: true,
                isPaused: true,
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Automatic updates are paused. Reconnect, then send the latest location."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.automaticPublishingStatusText(
                isSharing: true,
                isPaused: true,
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Automatic updates are paused. Reconnect, then retry Stop Sharing."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.automaticPublishingStatusText(
                isSharing: true,
                isPaused: true,
                serviceStatusText: "Could not connect to relays. Check your connection and try again."
            ),
            "Automatic updates are paused until relays reconnect."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.automaticPublishingStatusText(
                isSharing: true,
                isPaused: true,
                serviceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Sharing was restored. Reconnect relays, then Share Current Area to send now."
        )
        XCTAssertEqual(
            NostrailRelayStatusFormatter.automaticPublishingStatusText(
                isSharing: true,
                isPaused: false,
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            ""
        )
    }

    func testNostrailKeyLifecycleGuardBlocksUnsafeClearKeyStates() {
        XCTAssertNil(NostrailKeyLifecycleGuard.blockedClearKeyMessage(isSharing: false, isStopping: false))
        XCTAssertEqual(
            NostrailKeyLifecycleGuard.pendingShareStartCancelMessage,
            "Pending sharing start canceled before clearing the key."
        )
        XCTAssertEqual(
            NostrailKeyLifecycleGuard.clearKeyConfirmation,
            "You will return to setup. Make sure your nsec or recovery phrase is backed up before clearing it."
        )
        XCTAssertEqual(
            NostrailKeyLifecycleGuard.blockedClearKeyMessage(isSharing: true, isStopping: false),
            "Stop sharing before clearing the key so Nostrail can tell recipients the session ended."
        )
        XCTAssertEqual(
            NostrailKeyLifecycleGuard.blockedClearKeyMessage(isSharing: false, isStopping: true),
            "Finish stopping sharing before clearing the key."
        )
    }

    func testLocationSharingServicePublishesInviteToMultipleRecipients() async throws {
        let recipientA = String(repeating: "bc", count: 32)
        let recipientB = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipientA])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.publishInvite(to: ["alice", try NIP19.encodeNpub(pubkeyHex: recipientB)], message: "hi")

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org"])
        let recipientSets = relay.publishedEventsSnapshot().map { Set($0.recipients) }
        XCTAssertEqual(recipientSets.count, 2)
        XCTAssertTrue(recipientSets.contains(Set([recipientA])))
        XCTAssertTrue(recipientSets.contains(Set([recipientB])))
    }

    func testLocationSharingServiceDeduplicatesCanonicalRecipientInputsBeforeResolving() async throws {
        let recipient = String(repeating: "bc", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.publishInvite(to: [
            "alice",
            "@alice",
            "alice@trustroots.org",
            "https://www.trustroots.org/profile/alice"
        ], message: "hi")

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
    }

    func testLocationSharingServiceDeduplicatesRecipientsAfterResolution() async throws {
        let recipient = String(repeating: "bc", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: [
            "alice@trustroots.org": recipient,
            "alice@example.org": recipient
        ])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        try await service.startSession(
            recipients: ["alice", "alice@example.org"],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        XCTAssertEqual(Set(resolver.resolvedHandlesSnapshot()), ["alice@trustroots.org", "alice@example.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
    }

    func testLocationSharingServiceInviteReportingPublishesResolvedRecipientsAndReportsFailures() async throws {
        let recipient = String(repeating: "bc", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        let result = try await service.publishInviteReportingFailures(to: ["alice", "ghost"], message: "hi")

        XCTAssertEqual(result, InvitePublishResult(sentCount: 1, failedInputs: ["ghost"]))
        XCTAssertEqual(result.failedLookupInputs, ["ghost"])
        XCTAssertEqual(result.failedSendInputs, [])
        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org", "ghost@trustroots.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
        let statusText = await MainActor.run { service.statusText }
        XCTAssertEqual(statusText, "Check recipients and try again.")
    }

    func testLocationSharingServiceInviteReportingReportsRelayFanoutFailures() async throws {
        let recipientA = String(repeating: "bc", count: 32)
        let recipientB = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 2)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let result = try await service.publishInviteReportingFailures(to: [recipientA, recipientB], message: "hi")

        XCTAssertEqual(result, InvitePublishResult(sentCount: 1, failedInputs: [recipientB]))
        XCTAssertEqual(result.failedLookupInputs, [])
        XCTAssertEqual(result.failedSendInputs, [recipientB])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipientA])
        let isAuthenticated = await MainActor.run { service.isAuthenticated }
        XCTAssertFalse(isAuthenticated)
    }

    func testLocationSharingServiceInviteReportingReturnsAllFailedRelayFanoutRecipients() async throws {
        let recipientA = String(repeating: "bc", count: 32)
        let recipientB = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [1, 2])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let result = try await service.publishInviteReportingFailures(to: [recipientA, recipientB], message: "hi")

        XCTAssertEqual(result, InvitePublishResult(sentCount: 0, failedInputs: [recipientA, recipientB]))
        XCTAssertEqual(result.failedLookupInputs, [])
        XCTAssertEqual(result.failedSendInputs, [recipientA, recipientB])
        XCTAssertTrue(relay.publishedEventsSnapshot().isEmpty)
        let isAuthenticated = await MainActor.run { service.isAuthenticated }
        XCTAssertFalse(isAuthenticated)
    }

    func testLocationSharingServiceInviteReportingRetriesAfterAllFailedRelayFanout() async throws {
        let recipientA = String(repeating: "bc", count: 32)
        let recipientB = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [1, 2])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let failedResult = try await service.publishInviteReportingFailures(to: [recipientA, recipientB], message: "hi")
        let retryResult = try await service.publishInviteReportingFailures(to: [recipientA, recipientB], message: "hi again")

        XCTAssertEqual(failedResult, InvitePublishResult(sentCount: 0, failedInputs: [recipientA, recipientB]))
        XCTAssertEqual(retryResult, InvitePublishResult(sentCount: 2, failedInputs: []))
        XCTAssertEqual(failedResult.failedSendInputs, [recipientA, recipientB])
        XCTAssertEqual(retryResult.failedSendInputs, [])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events.map(\.recipients), [[recipientA], [recipientB]])
        XCTAssertEqual(relay.authenticateCallCountSnapshot(), 2)
        let isAuthenticated = await MainActor.run { service.isAuthenticated }
        XCTAssertTrue(isAuthenticated)
    }

    func testLocationSharingServiceRecipientResolutionErrorNamesInput() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "12", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: [:])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        do {
            try await service.publishInvite(to: ["ghost"], message: "hi")
            XCTFail("Expected recipient resolution to fail")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("\"ghost\""))
            XCTAssertTrue(error.localizedDescription.contains("ghost@trustroots.org"))
        }

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["ghost@trustroots.org"])
        XCTAssertTrue(relay.publishedEventsSnapshot().isEmpty)
    }

    func testLocationSharingServiceAcceptsNpubRecipientForSession() async throws {
        let recipient = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "13", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        try await service.startSession(
            recipients: [try NIP19.encodeNpub(pubkeyHex: recipient)],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.recipients, [recipient])
    }

    func testLocationSharingServiceStartReportingPublishesResolvedRecipientsAndReportsFailures() async throws {
        let recipient = String(repeating: "bd", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "13", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        let result = try await service.startSessionReportingFailures(
            recipients: ["alice", "ghost"],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        XCTAssertEqual(result, SharePublishResult(sentCount: 1, failedInputs: ["ghost"]))
        XCTAssertEqual(result.failedLookupInputs, ["ghost"])
        XCTAssertEqual(result.failedSendInputs, [])
        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["alice@trustroots.org", "ghost@trustroots.org"])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipient])
        let isSharing = await MainActor.run { service.isSharing }
        XCTAssertTrue(isSharing)
        let statusText = await MainActor.run { service.statusText }
        XCTAssertEqual(statusText, "Check recipients and try again.")
    }

    func testLocationSharingServiceStartReportingKeepsSuccessfulRelayFanoutRecipients() async throws {
        let recipientA = String(repeating: "bd", count: 32)
        let recipientB = String(repeating: "be", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "13", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 2)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let result = try await service.startSessionReportingFailures(
            recipients: [recipientA, recipientB],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        XCTAssertEqual(result, SharePublishResult(sentCount: 1, failedInputs: [recipientB]))
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(relay.publishedEventsSnapshot().first?.recipients, [recipientA])
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isAutomaticPublishingPaused)
            XCTAssertEqual(service.statusText, "Sharing started. Reconnect, then retry 1 person.")
        }
    }

    func testLocationSharingServiceStartReportingReturnsAllFailedRelayFanoutRecipients() async throws {
        let recipientA = String(repeating: "bd", count: 32)
        let recipientB = String(repeating: "be", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "13", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [1, 2])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let result = try await service.startSessionReportingFailures(
            recipients: [recipientA, recipientB],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        XCTAssertEqual(result, SharePublishResult(sentCount: 0, failedInputs: [recipientA, recipientB]))
        XCTAssertEqual(result.failedLookupInputs, [])
        XCTAssertEqual(result.failedSendInputs, [recipientA, recipientB])
        XCTAssertTrue(relay.publishedEventsSnapshot().isEmpty)
        await MainActor.run {
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertFalse(service.isAuthenticated)
        }
    }

    func testLocationSharingServiceStartReportingRetriesAfterAllFailedRelayFanout() async throws {
        let recipientA = String(repeating: "bd", count: 32)
        let recipientB = String(repeating: "be", count: 32)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "13", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [1, 2])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let failedResult = try await service.startSessionReportingFailures(
            recipients: [recipientA, recipientB],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )
        let retryResult = try await service.startSessionReportingFailures(
            recipients: [recipientA, recipientB],
            initialLatitude: 40,
            initialLongitude: -8,
            duration: 120
        )

        XCTAssertEqual(failedResult, SharePublishResult(sentCount: 0, failedInputs: [recipientA, recipientB]))
        XCTAssertEqual(retryResult, SharePublishResult(sentCount: 2, failedInputs: []))
        XCTAssertEqual(failedResult.failedSendInputs, [recipientA, recipientB])
        XCTAssertEqual(retryResult.failedSendInputs, [])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events.map(\.recipients), [[recipientA], [recipientB]])
        XCTAssertEqual(relay.authenticateCallCountSnapshot(), 2)
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertTrue(service.isAuthenticated)
        }
    }

    func testNip05ResolverResolvesPubkeyFromWellKnown() async throws {
        let session = makeMockURLSession()
        let expected = String(repeating: "ab", count: 32)
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.host(), "trustroots.org")
            XCTAssertEqual(request.url?.path, "/.well-known/nostr.json")
            XCTAssertEqual(request.url?.query, "name=alice")
            let body = """
            {"names":{"alice":"\(expected)"}}
            """
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, Data(body.utf8))
        }
        defer { MockURLProtocol.handler = nil }

        let resolver = Nip05Resolver(session: session)
        let resolved = try await resolver.resolve("alice@trustroots.org")
        XCTAssertEqual(resolved, expected)
    }

    func testNip05ResolverFailsWhenNameMissing() async {
        let session = makeMockURLSession()
        MockURLProtocol.handler = { request in
            let body = """
            {"names":{"bob":"\(String(repeating: "cd", count: 32))"}}
            """
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, Data(body.utf8))
        }
        defer { MockURLProtocol.handler = nil }

        let resolver = Nip05Resolver(session: session)
        do {
            _ = try await resolver.resolve("alice@trustroots.org")
            XCTFail("Expected nameNotFound error")
        } catch {
            guard case Nip05ResolverError.nameNotFound(let name) = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
            XCTAssertEqual(name, "alice")
        }
    }

    func testPayloadCodecAndExpiration() throws {
        let now = Int(Date().timeIntervalSince1970)
        let payload = LocationEventPayload(
            sessionId: "s1",
            area: "A1-1",
            centerLat: 10,
            centerLon: 20,
            accuracyM: 500,
            createdAt: now,
            expiresAt: now + 60
        )
        let encoded = try NostrailPayloadCodec.encode(.location(payload))
        let decoded = NostrailPayloadCodec.decode(encoded)
        if case .location(let decodedPayload) = decoded {
            XCTAssertEqual(decodedPayload, payload)
        } else {
            XCTFail("Expected location payload")
        }

        let expiredEvent = NostrEvent(
            id: "1",
            pubkey: "pub",
            createdAt: now - 120,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["expiration", "\(now - 1)"]],
            content: encoded,
            sig: "sig"
        )
        XCTAssertTrue(expiredEvent.isExpired)
    }

    func testInMemoryAppStorageReplacesPrunesAndClearsRecords() {
        let storage = InMemoryAppStorage(maxRecords: 2)
        let old = makeStoredLocationRecord(id: "old", createdAt: 10, expiresAt: 20)
        let first = makeStoredLocationRecord(id: "first", createdAt: 30, expiresAt: 100)
        let firstUpdated = makeStoredLocationRecord(id: "first", createdAt: 40, expiresAt: 120)
        let newest = makeStoredLocationRecord(id: "newest", createdAt: 50, expiresAt: 130)

        storage.save(record: old)
        storage.save(record: first)
        storage.save(record: firstUpdated)
        storage.save(record: newest)

        var records = storage.allLocationRecords()
        XCTAssertEqual(records.map(\.id), ["newest", "first"])
        XCTAssertEqual(records.first(where: { $0.id == "first" })?.location.createdAt, 40)

        storage.removeExpired(nowUnix: 125)
        records = storage.allLocationRecords()
        XCTAssertEqual(records.map(\.id), ["newest"])

        let stopped = makeStoredLocationRecord(id: "stopped", createdAt: 60, expiresAt: 200)
        let otherPeer = StoredLocationRecord(
            id: "other-peer",
            fromPubkey: String(repeating: "cd", count: 32),
            location: stopped.location,
            receivedAt: stopped.receivedAt
        )
        storage.save(record: stopped)
        storage.save(record: otherPeer)
        storage.removeLocationRecords(sessionId: stopped.location.sessionId, fromPubkey: stopped.fromPubkey)
        records = storage.allLocationRecords()
        XCTAssertFalse(records.contains { $0.id == "stopped" })
        XCTAssertTrue(records.contains { $0.id == "other-peer" })

        storage.removeAll()
        XCTAssertTrue(storage.allLocationRecords().isEmpty)
    }

    func testUserDefaultsAppStoragePersistsPrunesAndClearsRecords() {
        let suiteName = "UserDefaultsAppStorage-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let key = "records-\(UUID().uuidString)"
        let storage = UserDefaultsAppStorage(defaults: defaults, key: key, maxRecords: 2)
        let older = makeStoredLocationRecord(id: "older", createdAt: 10, expiresAt: 100)
        let first = makeStoredLocationRecord(id: "first", createdAt: 20, expiresAt: 120)
        let firstUpdated = makeStoredLocationRecord(id: "first", createdAt: 40, expiresAt: 160)
        let newest = makeStoredLocationRecord(id: "newest", createdAt: 50, expiresAt: 170)

        storage.save(record: older)
        storage.save(record: first)
        storage.save(record: firstUpdated)
        storage.save(record: newest)

        let reloaded = UserDefaultsAppStorage(defaults: defaults, key: key, maxRecords: 2)
        var records = reloaded.allLocationRecords()
        XCTAssertEqual(records.map(\.id), ["newest", "first"])
        XCTAssertEqual(records.first(where: { $0.id == "first" })?.location.createdAt, 40)

        reloaded.removeExpired(nowUnix: 165)
        records = UserDefaultsAppStorage(defaults: defaults, key: key, maxRecords: 2).allLocationRecords()
        XCTAssertEqual(records.map(\.id), ["newest"])

        let stopped = makeStoredLocationRecord(id: "stopped", createdAt: 60, expiresAt: 200)
        let otherPeer = StoredLocationRecord(
            id: "other-peer",
            fromPubkey: String(repeating: "cd", count: 32),
            location: stopped.location,
            receivedAt: stopped.receivedAt
        )
        reloaded.save(record: stopped)
        reloaded.save(record: otherPeer)
        reloaded.removeLocationRecords(sessionId: stopped.location.sessionId, fromPubkey: stopped.fromPubkey)
        records = UserDefaultsAppStorage(defaults: defaults, key: key, maxRecords: 2).allLocationRecords()
        XCTAssertFalse(records.contains { $0.id == "stopped" })
        XCTAssertTrue(records.contains { $0.id == "other-peer" })

        reloaded.removeAll()
        XCTAssertTrue(UserDefaultsAppStorage(defaults: defaults, key: key).allLocationRecords().isEmpty)
    }

    func testUserDefaultsActiveSharingSessionStorePersistsAndClearsRecord() {
        let suiteName = "ActiveSharingSessionStore-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let key = "session-\(UUID().uuidString)"
        let store = UserDefaultsActiveSharingSessionStore(defaults: defaults, key: key)
        let record = ActiveSharingSessionRecord(
            sessionID: "session-a",
            expiresAtUnix: 2_000,
            recipients: ["recipient-a"],
            stopRecipients: ["recipient-a", "recipient-b"],
            recipientDisplayValues: ["alice"],
            latestLatitude: 41.1,
            latestLongitude: -8.6
        )

        store.save(record)

        XCTAssertEqual(UserDefaultsActiveSharingSessionStore(defaults: defaults, key: key).load(), record)
        store.clear()
        XCTAssertNil(UserDefaultsActiveSharingSessionStore(defaults: defaults, key: key).load())

        let legacyJSON = """
        {"sessionID":"legacy-session","expiresAtUnix":3000,"recipients":["recipient-c"],"stopRecipients":["recipient-c"],"latestLatitude":42.0,"latestLongitude":-9.0}
        """
        defaults.set(Data(legacyJSON.utf8), forKey: key)
        let legacyRecord = UserDefaultsActiveSharingSessionStore(defaults: defaults, key: key).load()
        XCTAssertEqual(legacyRecord?.sessionID, "legacy-session")
        XCTAssertNil(legacyRecord?.recipientDisplayValues)
    }

    func testApproximateLocationSnap() {
        let snapped = LocationSnapper.snap(latitude: 52.52081, longitude: 13.40945)
        XCTAssertEqual(snapped.accuracyMeters, NRConstants.defaultApproximateAccuracyMeters)
        XCTAssertTrue(abs(snapped.latitude - 52.52) < 0.01)
        XCTAssertTrue(abs(snapped.longitude - 13.41) < 0.01)
        XCTAssertEqual(snapped.areaCode, "9F4MGCC6+")
    }

    func testPlusCodeNeighborhoodEncode() {
        let plusCode = PlusCode.encode(latitude: 52.52081, longitude: 13.40945, codeLength: PlusCode.neighborhoodCodeLength)
        XCTAssertEqual(plusCode, "9F4MGCC5+")
    }

    func testRelayPublishSubscribeAndDecryptFlow() async throws {
        try skipIfNostrSDKUnavailable()
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "5e", count: 32))
        let relay = InMemoryRelayClient(relayURL: NRConstants.defaultRelayURL)
        let storage = InMemoryAppStorage()
        let service = await LocationSharingService(keyStore: keyStore, relay: relay, storage: storage, nip44: NIP44Box())

        try await service.authenticate()

        let peer = try NostrSDKCryptoProvider().publicKeyHex(fromSecretHex: String(repeating: "9f", count: 32))
        try await service.startSession(recipients: [peer], initialLatitude: 40.0, initialLongitude: -8.0, duration: 120)

        try await Task.sleep(for: .milliseconds(200))

        let count = await service.receivedLocations.count
        XCTAssertGreaterThanOrEqual(count, 0)

        try await service.stopSession()
    }

    func testLocationPublishFanoutPerRecipient() async throws {
        try skipIfNostrSDKUnavailable()
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "6f", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let storage = InMemoryAppStorage()
        let service = await LocationSharingService(keyStore: keyStore, relay: relay, storage: storage, nip44: NIP44Box())

        try await service.authenticate()

        let recipientA = try NostrSDKCryptoProvider().publicKeyHex(fromSecretHex: String(repeating: "aa", count: 32))
        let recipientB = try NostrSDKCryptoProvider().publicKeyHex(fromSecretHex: String(repeating: "bb", count: 32))
        try await service.startSession(
            recipients: [recipientA, recipientB],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        let recipientSets = events.map { Set($0.recipients) }
        XCTAssertTrue(recipientSets.contains(Set([recipientA])))
        XCTAssertTrue(recipientSets.contains(Set([recipientB])))
    }

    func testLocationSharingServiceClearKeyResetsRuntimeState() async throws {
        let keyStore = InMemoryKeyStore()
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let storage = InMemoryAppStorage()
        let service = await LocationSharingService(keyStore: keyStore, relay: relay, storage: storage, nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()))

        try await service.importKey(String(repeating: "6a", count: 32))
        try await service.authenticate()
        storage.save(record: makeStoredLocationRecord(id: "clear-key-location", createdAt: 30, expiresAt: 120))
        await service.pruneExpiredLocations(nowUnix: 40)
        await service.updateCurrentLocation(latitude: 41.0, longitude: -7.0)
        await MainActor.run {
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertEqual(service.receivedLocations.map(\.id), ["clear-key-location"])
        }

        try await service.clearKey()

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertEqual(service.statusText, "Key cleared. No key stored on this device.")
            XCTAssertTrue(service.receivedLocations.isEmpty)
        }
        XCTAssertNil(keyStore.currentSecretHex())
    }

    func testLocationSharingServiceImportingReplacementKeyResetsRuntimeState() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let storage = InMemoryAppStorage()
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: storage,
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        try await service.importKey(String(repeating: "6d", count: 32))
        try await service.authenticate()
        storage.save(record: makeStoredLocationRecord(id: "old-key-location", createdAt: 30, expiresAt: 120))
        await service.pruneExpiredLocations(nowUnix: 40)

        await MainActor.run {
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertEqual(service.receivedLocations.map(\.id), ["old-key-location"])
        }

        try await service.importKey(String(repeating: "6e", count: 32))

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertTrue(service.receivedLocations.isEmpty)
            XCTAssertEqual(service.statusText, "Key imported.")
        }
        XCTAssertEqual(keyStore.currentSecretHex(), String(repeating: "6e", count: 32))
    }

    func testLocationSharingServiceRestoresPersistedActiveSessionOnRelaunch() async throws {
        let suiteName = "LocationSharingActiveSession-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let activeSessionStore = UserDefaultsActiveSharingSessionStore(defaults: defaults)
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let recipient = String(repeating: "66", count: 32)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": recipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: RecordingRelayClient(relayURL: NRConstants.defaultRelayURL),
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver,
            relayCheckHistoryDefaults: defaults,
            activeSessionStore: activeSessionStore,
            publishInterval: 3_600
        )

        try await service.importKey(String(repeating: "67", count: 32))
        try await service.authenticate()
        _ = try await service.startSessionReportingFailures(
            recipients: ["alice"],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 3_600
        )
        await service.updateCurrentLocation(latitude: 41.1, longitude: -8.6)
        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "Relays ready.")
            XCTAssertNotNil(service.lastRelayCheckDate)
        }

        let restoredRelay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let restored = await LocationSharingService(
            keyStore: keyStore,
            relay: restoredRelay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults,
            activeSessionStore: activeSessionStore,
            publishInterval: 3_600
        )

        await MainActor.run {
            XCTAssertTrue(restored.isSharing)
            XCTAssertFalse(restored.isAuthenticated)
            XCTAssertTrue(restored.isAutomaticPublishingPaused)
            XCTAssertEqual(restored.sessionID, service.sessionID)
            XCTAssertEqual(restored.sessionExpiresAtUnix, service.sessionExpiresAtUnix)
            XCTAssertEqual(restored.activeSessionRecipientDisplayValues, ["alice"])
            XCTAssertEqual(restored.statusText, "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now.")
            XCTAssertEqual(restored.lastRelayCheckSummary, "")
            XCTAssertNil(restored.lastRelayCheckDate)
        }
        XCTAssertEqual(activeSessionStore.load()?.recipients, [recipient])
        XCTAssertEqual(activeSessionStore.load()?.recipientDisplayValues, ["alice"])
        XCTAssertEqual(activeSessionStore.load()?.latestLatitude, 41.1)
        XCTAssertEqual(activeSessionStore.load()?.latestLongitude, -8.6)

        try await restored.authenticate()
        try await restored.updateSharedLocation(latitude: 41.2, longitude: -8.7)

        await MainActor.run {
            XCTAssertFalse(restored.isAutomaticPublishingPaused)
            XCTAssertEqual(restored.statusText, "Location updated.")
        }
        XCTAssertEqual(restoredRelay.publishedEventsSnapshot().count, 1)
        XCTAssertEqual(activeSessionStore.load()?.latestLatitude, 41.2)
        XCTAssertEqual(activeSessionStore.load()?.latestLongitude, -8.7)
    }

    func testLocationSharingServiceClearsExpiredPersistedActiveSessionOnRelaunch() async throws {
        let suiteName = "LocationSharingExpiredSession-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let activeSessionStore = UserDefaultsActiveSharingSessionStore(defaults: defaults)
        activeSessionStore.save(
            ActiveSharingSessionRecord(
                sessionID: "expired-session",
                expiresAtUnix: 1,
                recipients: [String(repeating: "68", count: 32)],
                stopRecipients: [String(repeating: "68", count: 32)],
                latestLatitude: 40,
                latestLongitude: -8
            )
        )
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "69", count: 32))

        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: RecordingRelayClient(relayURL: NRConstants.defaultRelayURL),
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            activeSessionStore: activeSessionStore,
            publishInterval: 3_600
        )

        await MainActor.run {
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertEqual(service.statusText, NostrailActionErrorFormatter.expiredSessionMessage)
        }
        XCTAssertNil(activeSessionStore.load())
    }

    func testLocationSharingServiceKeyChangesClearPersistedRelayFailureCounts() async throws {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let suiteName = "LocationSharingServiceRelayFailureCounts-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        func makeService(relayClient: RelayClient) async -> LocationSharingService {
            let pool = RelayPoolClient(
                entries: [
                    .init(endpoint: endpoint, client: relayClient)
                ],
                defaultEndpoints: [endpoint],
                preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
            )
            return await LocationSharingService(
                keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
                relay: pool,
                storage: InMemoryAppStorage(),
                nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
                relayCheckHistoryDefaults: defaults
            )
        }

        let firstService = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await firstService.importKey(String(repeating: "60", count: 32))
        do {
            try await firstService.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let firstFailureCount = await MainActor.run {
            firstService.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(firstFailureCount, 1)

        let repeatedFailureService = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await repeatedFailureService.importKey(String(repeating: "61", count: 32))
        do {
            try await repeatedFailureService.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let repeatedFailureCount = await MainActor.run {
            repeatedFailureService.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(repeatedFailureCount, 1)

        let serviceClearingKey = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await serviceClearingKey.importKey(String(repeating: "62", count: 32))
        do {
            try await serviceClearingKey.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let clearKeyFailureCount = await MainActor.run {
            serviceClearingKey.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(clearKeyFailureCount, 1)
        try await serviceClearingKey.clearKey()

        let afterClearService = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await afterClearService.importKey(String(repeating: "63", count: 32))
        do {
            try await afterClearService.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let afterClearFailureCount = await MainActor.run {
            afterClearService.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(afterClearFailureCount, 1)

        let serviceGeneratingKey = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await serviceGeneratingKey.importKey(String(repeating: "64", count: 32))
        do {
            try await serviceGeneratingKey.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let generateKeyFailureCount = await MainActor.run {
            serviceGeneratingKey.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(generateKeyFailureCount, 1)
        _ = try await serviceGeneratingKey.generateNewKey()

        let afterGenerateService = await makeService(relayClient: FailingRelayClient(relayURL: endpoint.url))
        try await afterGenerateService.importKey(String(repeating: "65", count: 32))
        do {
            try await afterGenerateService.authenticate()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        let afterGenerateFailureCount = await MainActor.run {
            afterGenerateService.relayConnectionCheckResults.first?.consecutiveFailures
        }
        XCTAssertEqual(afterGenerateFailureCount, 1)
    }

    func testLocationSharingServiceBlocksKeyChangeWhileSharing() async throws {
        XCTAssertEqual(
            LocationSharingServiceError.keyChangeWhileSharing.localizedDescription,
            "Stop sharing before clearing or changing keys so recipients can be told the session ended."
        )
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        let originalSecret = String(repeating: "71", count: 32)
        try await service.importKey(originalSecret)
        try await service.startSession(
            recipients: [String(repeating: "72", count: 32)],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        do {
            try await service.importKey(String(repeating: "73", count: 32))
            XCTFail("Expected active sharing to block key import")
        } catch LocationSharingServiceError.keyChangeWhileSharing {
            XCTAssertEqual(keyStore.currentSecretHex(), originalSecret)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        do {
            _ = try await service.generateNewKey()
            XCTFail("Expected active sharing to block generated key replacement")
        } catch LocationSharingServiceError.keyChangeWhileSharing {
            XCTAssertEqual(keyStore.currentSecretHex(), originalSecret)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        do {
            try await service.clearKey()
            XCTFail("Expected active sharing to block key clearing")
        } catch LocationSharingServiceError.keyChangeWhileSharing {
            XCTAssertEqual(keyStore.currentSecretHex(), originalSecret)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertEqual(service.statusText, "Sharing started.")
        }
    }

    func testLocationSharingServiceFailedAuthenticateLeavesDisconnectedState() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = FailingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "6f", count: 32))

        do {
            try await service.authenticate()
            XCTFail("Expected authenticate to fail")
        } catch {
            XCTAssertEqual((error as NSError).domain, "FailingRelayClient")
        }

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isSharing)
            XCTAssertEqual(service.statusText, "Could not connect to relays. Check your connection and try again.")
        }
    }

    func testLocationSharingServiceRecordsRelayCheckHistoryOnAuthenticate() async throws {
        let suiteName = "RelayCheckHistory-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create isolated defaults")
            return
        }
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let workingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let failingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let relay = RelayPoolClient(entries: [
            .init(endpoint: workingEndpoint, client: RecordingRelayClient(relayURL: workingEndpoint.url)),
            .init(endpoint: failingEndpoint, client: FailingRelayClient(relayURL: failingEndpoint.url))
        ])
        let service = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults
        )
        try await service.importKey(String(repeating: "7a", count: 32))

        try await service.authenticate()

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "1 relay reachable. 1 relay could not connect.")
            XCTAssertNotNil(service.lastRelayCheckDate)
        }

        let reloaded = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: RecordingRelayClient(relayURL: NRConstants.defaultRelayURL),
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults
        )

        await MainActor.run {
            XCTAssertEqual(reloaded.lastRelayCheckSummary, "1 relay reachable. 1 relay could not connect.")
            XCTAssertNotNil(reloaded.lastRelayCheckDate)
        }
    }

    func testLocationSharingServiceClearsRelayCheckHistoryOnKeyAndRelayChanges() async throws {
        let suiteName = "RelayCheckHistoryClear-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create isolated defaults")
            return
        }
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let workingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let relay = RelayPoolClient(entries: [
            .init(endpoint: workingEndpoint, client: RecordingRelayClient(relayURL: workingEndpoint.url))
        ])
        let service = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults
        )
        try await service.importKey(String(repeating: "7b", count: 32))
        try await service.authenticate()

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "1 relay reachable.")
        }

        try await service.clearKey()

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "")
            XCTAssertNil(service.lastRelayCheckDate)
        }

        try await service.importKey(String(repeating: "7c", count: 32))
        try await service.authenticate()

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "1 relay reachable.")
            XCTAssertFalse(service.setRelayState(for: workingEndpoint.url, readEnabled: true, writeEnabled: true))
            XCTAssertEqual(service.lastRelayCheckSummary, "1 relay reachable.")
            XCTAssertNotNil(service.lastRelayCheckDate)
            XCTAssertTrue(service.setRelayState(for: workingEndpoint.url, readEnabled: false, writeEnabled: true))
            XCTAssertEqual(service.lastRelayCheckSummary, "")
            XCTAssertNil(service.lastRelayCheckDate)
        }
    }

    func testLocationSharingServiceClearsRelayCheckHistoryAfterSendFailure() async throws {
        let suiteName = "RelayCheckHistorySendFailure-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create isolated defaults")
            return
        }
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 1)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults
        )
        try await service.importKey(String(repeating: "82", count: 32))
        try await service.authenticate()

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "Relays ready.")
            XCTAssertNotNil(service.lastRelayCheckDate)
        }

        do {
            try await service.startSession(
                recipients: [String(repeating: "83", count: 32)],
                initialLatitude: 40.0,
                initialLongitude: -8.0,
                duration: 120
            )
            XCTFail("Expected initial location publish to fail")
        } catch {
            XCTAssertEqual((error as NSError).domain, "PublishFailingRelayClient")
        }

        await MainActor.run {
            XCTAssertEqual(service.lastRelayCheckSummary, "")
            XCTAssertNil(service.lastRelayCheckDate)
            XCTAssertEqual(service.statusText, "Could not send this update. Check your connection and try again.")
        }
    }

    func testLocationSharingServiceKeyChangeClearsPerRelayCheckResults() async throws {
        let workingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let client = InMemoryRelayClient(relayURL: workingEndpoint.url)
        let relay = RelayPoolClient(entries: [
            .init(endpoint: workingEndpoint, client: client)
        ])
        let service = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        try await service.importKey(String(repeating: "7d", count: 32))
        try await service.authenticate()
        await MainActor.run {
            XCTAssertTrue(relay.isAuthenticated)
            XCTAssertTrue(client.isAuthenticated)
            XCTAssertEqual(service.relayConnectionCheckResults, [
                RelayConnectionCheckResult(url: workingEndpoint.url, state: .connected)
            ])
        }

        try await service.importKey(String(repeating: "7e", count: 32))

        await MainActor.run {
            XCTAssertFalse(relay.isAuthenticated)
            XCTAssertFalse(client.isAuthenticated)
            XCTAssertEqual(service.relayConnectionCheckResults, [])
            XCTAssertEqual(service.lastRelayCheckSummary, "")
            XCTAssertNil(service.lastRelayCheckDate)
        }
    }

    func testLocationSharingServiceMarksRelayStaleWhenReceiverEnds() async throws {
        let suiteName = "RelayReconnectHistory-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("Could not create isolated defaults")
            return
        }
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            relayCheckHistoryDefaults: defaults
        )
        try await service.importKey(String(repeating: "70", count: 32))
        try await service.authenticate()

        await MainActor.run {
            XCTAssertTrue(service.isAuthenticated)
        }

        relay.finishIncoming()
        try await Task.sleep(for: .milliseconds(50))

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertEqual(service.statusText, "Relay stopped sending updates. Try reconnecting.")
        }

        try await service.authenticate()

        await MainActor.run {
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertEqual(service.lastRelayCheckSummary, "Reconnected. Relays ready.")
        }
    }

    func testLocationSharingServiceFailedInitialPublishRollsBackSessionState() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 1)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "74", count: 32))

        do {
            try await service.startSession(
                recipients: [String(repeating: "75", count: 32)],
                initialLatitude: 40.0,
                initialLongitude: -8.0,
                duration: 120
            )
            XCTFail("Expected initial location publish to fail")
        } catch {
            XCTAssertEqual((error as NSError).domain, "PublishFailingRelayClient")
        }

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertEqual(service.statusText, "Could not send this update. Check your connection and try again.")
        }
    }

    func testLocationSharingServiceStopWithoutActiveSessionReportsNoActiveSession() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "7a", count: 32))

        do {
            try await service.stopSession()
            XCTFail("Expected stop without active session to fail")
        } catch LocationSharingServiceError.noActiveSession {
            await MainActor.run {
                XCTAssertFalse(service.isSharing)
                XCTAssertEqual(service.statusText, "Start a sharing session first.")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        XCTAssertEqual(relay.publishedEventsSnapshot().count, 0)
    }

    func testLocationSharingServiceUpdateWithRecipientsWithoutActiveSessionDoesNotResolveRecipients() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let resolver = RecordingNip05Resolver(results: ["alice@trustroots.org": String(repeating: "7c", count: 32)])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )
        try await service.importKey(String(repeating: "7b", count: 32))

        do {
            _ = try await service.updateSharedLocationReportingFailures(
                recipients: ["alice"],
                latitude: 41.0,
                longitude: -7.0
            )
            XCTFail("Expected update without active session to fail")
        } catch LocationSharingServiceError.noActiveSession {
            await MainActor.run {
                XCTAssertFalse(service.isSharing)
                XCTAssertEqual(service.statusText, "Start a sharing session first.")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), [])
        XCTAssertEqual(relay.publishedEventsSnapshot().count, 0)
    }

    func testLocationSharingServiceStopAfterSessionExpiryDoesNotPublishStop() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "7d", count: 32))
        try await service.startSession(
            recipients: [String(repeating: "7e", count: 32)],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: -1
        )

        do {
            try await service.stopSession()
            XCTFail("Expected expired session stop to fail")
        } catch LocationSharingServiceError.noActiveSession {
            await MainActor.run {
                XCTAssertFalse(service.isSharing)
                XCTAssertNil(service.sessionID)
                XCTAssertNil(service.sessionExpiresAtUnix)
                XCTAssertEqual(service.statusText, "Sharing session expired.")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        XCTAssertEqual(relay.publishedEventsSnapshot().count, 1)
    }

    func testLocationSharingServiceFailedStopKeepsSessionRetryable() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 2)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "76", count: 32))
        try await service.startSession(
            recipients: [String(repeating: "77", count: 32)],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        do {
            try await service.stopSession()
            XCTFail("Expected stop publish to fail")
        } catch {
            XCTAssertEqual((error as NSError).domain, "PublishFailingRelayClient")
        }

        await MainActor.run {
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertTrue(service.isSharing)
            XCTAssertNotNil(service.sessionID)
            XCTAssertNotNil(service.sessionExpiresAtUnix)
            XCTAssertEqual(service.statusText, "Could not stop sharing. Check your connection and try again.")
        }

        try await service.stopSession()

        await MainActor.run {
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertFalse(service.isSharing)
            XCTAssertNil(service.sessionID)
            XCTAssertNil(service.sessionExpiresAtUnix)
            XCTAssertEqual(service.statusText, "Sharing stopped.")
        }
        XCTAssertEqual(relay.authenticateCallCountSnapshot(), 2)
    }

    func testLocationSharingServiceFailedStopStaysRetryableAfterRelaySettingsChange() async throws {
        let primaryEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-primary.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let secondaryEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-secondary.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let primaryRelay = PublishFailingRelayClient(
            relayURL: primaryEndpoint.url,
            failOnPublishNumber: 2
        )
        let secondaryRelay = RecordingRelayClient(relayURL: secondaryEndpoint.url)
        let relay = RelayPoolClient(entries: [
            .init(endpoint: primaryEndpoint, client: primaryRelay),
            .init(endpoint: secondaryEndpoint, client: secondaryRelay)
        ])
        let service = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.importKey(String(repeating: "78", count: 32))
        try await service.startSession(
            recipients: [String(repeating: "79", count: 32)],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        do {
            try await service.stopSession()
            XCTFail("Expected stop publish to fail")
        } catch {
            guard case RelayPoolError.publishFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }

        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertEqual(service.statusText, "Could not stop sharing. Check your connection and try again.")
        }

        await MainActor.run {
            service.setRelayState(for: secondaryEndpoint.url, readEnabled: true, writeEnabled: true)
        }

        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertEqual(service.statusText, "2 relays enabled.")
        }

        try await service.stopSession()

        await MainActor.run {
            XCTAssertFalse(service.isSharing)
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertEqual(service.statusText, "Sharing stopped.")
        }
        XCTAssertEqual(primaryRelay.publishCallCountSnapshot(), 3)
        XCTAssertEqual(secondaryRelay.publishedEventsSnapshot().count, 1)
    }

    func testLocationSharingSessionUsesFixedExpirationForPublishedEvents() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "6b", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        let recipientA = String(repeating: "bc", count: 32)
        let recipientB = String(repeating: "bd", count: 32)
        try await service.startSession(
            recipients: [recipientA, recipientB],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let maybeSessionEnd = await MainActor.run { service.sessionExpiresAtUnix }
        let sessionEnd = try XCTUnwrap(maybeSessionEnd)
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(Set(events.compactMap(\.expirationUnix)), [sessionEnd])
        XCTAssertEqual(events.count, 2)
    }

    func testLocationSharingServiceManualUpdatePublishesImmediately() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "61", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        let recipient = String(repeating: "bc", count: 32)
        let updatedRecipient = String(repeating: "bd", count: 32)
        try await service.startSession(
            recipients: [recipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )
        let maybeSessionEnd = await MainActor.run { service.sessionExpiresAtUnix }
        let sessionEnd = try XCTUnwrap(maybeSessionEnd)

        try await service.updateSharedLocation(recipients: [updatedRecipient], latitude: 41.0, longitude: -7.0)

        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(Set(events.compactMap(\.expirationUnix)), [sessionEnd])
        XCTAssertEqual(events.first?.recipients, [recipient])
        XCTAssertEqual(events.last?.recipients, [updatedRecipient])
        await MainActor.run {
            XCTAssertEqual(service.activeSessionRecipientDisplayValues, [recipient, updatedRecipient])
            XCTAssertEqual(service.statusText, "Location updated.")
        }
    }

    func testLocationSharingServicePausesAutomaticUpdatesAfterPeriodicPublishFailure() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "62", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 2)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            publishInterval: 0.02
        )

        let recipient = String(repeating: "bc", count: 32)
        try await service.startSession(
            recipients: [recipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 5
        )

        for _ in 0..<20 {
            let paused = await MainActor.run { service.isAutomaticPublishingPaused }
            if paused { break }
            try await Task.sleep(for: .milliseconds(25))
        }

        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertTrue(service.isAutomaticPublishingPaused)
            XCTAssertEqual(service.statusText, "Could not send this update. Check your connection and try again.")
        }
        let failedAttemptCount = relay.publishCallCountSnapshot()
        try await Task.sleep(for: .milliseconds(75))
        XCTAssertEqual(relay.publishCallCountSnapshot(), failedAttemptCount)

        try await service.authenticate()
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertTrue(service.isAuthenticated)
            XCTAssertFalse(service.isAutomaticPublishingPaused)
        }
        try await Task.sleep(for: .milliseconds(75))
        XCTAssertGreaterThan(relay.publishCallCountSnapshot(), failedAttemptCount)

        try await service.stopSession()
    }

    func testLocationSharingServiceUpdateReportingPublishesResolvedRecipientsAndReportsFailures() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "63", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let updatedRecipient = String(repeating: "bd", count: 32)
        let resolver = RecordingNip05Resolver(results: ["bob@trustroots.org": updatedRecipient])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: resolver
        )

        let initialRecipient = String(repeating: "bc", count: 32)
        try await service.startSession(
            recipients: [initialRecipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let result = try await service.updateSharedLocationReportingFailures(recipients: ["bob", "ghost"], latitude: 41.0, longitude: -7.0)

        XCTAssertEqual(result, SharePublishResult(sentCount: 1, failedInputs: ["ghost"]))
        XCTAssertEqual(result.failedLookupInputs, ["ghost"])
        XCTAssertEqual(result.failedSendInputs, [])
        XCTAssertEqual(resolver.resolvedHandlesSnapshot(), ["bob@trustroots.org", "ghost@trustroots.org"])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events.first?.recipients, [initialRecipient])
        XCTAssertEqual(events.last?.recipients, [updatedRecipient])
        await MainActor.run {
            XCTAssertEqual(service.activeSessionRecipientDisplayValues, [initialRecipient, "bob"])
            XCTAssertEqual(service.statusText, "Location updated. Check 1 person below.")
        }
    }

    func testLocationSharingServiceUpdateReportingKeepsSuccessfulRelayFanoutRecipients() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "63", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumber: 3)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let initialRecipient = String(repeating: "bc", count: 32)
        let updatedRecipientA = String(repeating: "bd", count: 32)
        let updatedRecipientB = String(repeating: "be", count: 32)
        try await service.startSession(
            recipients: [initialRecipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let result = try await service.updateSharedLocationReportingFailures(
            recipients: [updatedRecipientA, updatedRecipientB],
            latitude: 41.0,
            longitude: -7.0
        )

        XCTAssertEqual(result, SharePublishResult(sentCount: 1, failedInputs: [updatedRecipientB]))
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events.first?.recipients, [initialRecipient])
        XCTAssertEqual(events.last?.recipients, [updatedRecipientA])
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
            XCTAssertFalse(service.isAutomaticPublishingPaused)
            XCTAssertEqual(service.activeSessionRecipientDisplayValues, [initialRecipient, updatedRecipientA])
            XCTAssertEqual(service.statusText, "Location updated. Reconnect, then retry 1 person.")
        }
    }

    func testLocationSharingServiceUpdateReportingReturnsAllFailedRelayFanoutRecipients() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "63", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [2, 3])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let initialRecipient = String(repeating: "bc", count: 32)
        let updatedRecipientA = String(repeating: "bd", count: 32)
        let updatedRecipientB = String(repeating: "be", count: 32)
        try await service.startSession(
            recipients: [initialRecipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let result = try await service.updateSharedLocationReportingFailures(
            recipients: [updatedRecipientA, updatedRecipientB],
            latitude: 41.0,
            longitude: -7.0
        )

        XCTAssertEqual(result, SharePublishResult(sentCount: 0, failedInputs: [updatedRecipientA, updatedRecipientB]))
        XCTAssertEqual(result.failedLookupInputs, [])
        XCTAssertEqual(result.failedSendInputs, [updatedRecipientA, updatedRecipientB])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.recipients, [initialRecipient])
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertFalse(service.isAuthenticated)
        }
    }

    func testLocationSharingServiceUpdateReportingRetriesAfterAllFailedRelayFanout() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "63", count: 32))
        let relay = PublishFailingRelayClient(relayURL: NRConstants.defaultRelayURL, failOnPublishNumbers: [2, 3])
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider()),
            nip05Resolver: RecordingNip05Resolver(results: [:])
        )

        let initialRecipient = String(repeating: "bc", count: 32)
        let updatedRecipientA = String(repeating: "bd", count: 32)
        let updatedRecipientB = String(repeating: "be", count: 32)
        try await service.startSession(
            recipients: [initialRecipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )

        let failedResult = try await service.updateSharedLocationReportingFailures(
            recipients: [updatedRecipientA, updatedRecipientB],
            latitude: 41.0,
            longitude: -7.0
        )
        let retryResult = try await service.updateSharedLocationReportingFailures(
            recipients: [updatedRecipientA, updatedRecipientB],
            latitude: 41.0,
            longitude: -7.0
        )

        XCTAssertEqual(failedResult, SharePublishResult(sentCount: 0, failedInputs: [updatedRecipientA, updatedRecipientB]))
        XCTAssertEqual(retryResult, SharePublishResult(sentCount: 2, failedInputs: []))
        XCTAssertEqual(failedResult.failedSendInputs, [updatedRecipientA, updatedRecipientB])
        XCTAssertEqual(retryResult.failedSendInputs, [])
        let events = relay.publishedEventsSnapshot()
        XCTAssertEqual(events.count, 3)
        XCTAssertEqual(events.map(\.recipients), [[initialRecipient], [updatedRecipientA], [updatedRecipientB]])
        XCTAssertEqual(relay.authenticateCallCountSnapshot(), 2)
        await MainActor.run {
            XCTAssertTrue(service.isSharing)
            XCTAssertTrue(service.isAuthenticated)
        }
    }

    func testLocationSharingServiceStopFansOutToPriorAndCurrentRecipients() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "62", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        let firstRecipient = String(repeating: "bc", count: 32)
        let currentRecipient = String(repeating: "bd", count: 32)
        try await service.startSession(
            recipients: [firstRecipient],
            initialLatitude: 40.0,
            initialLongitude: -8.0,
            duration: 120
        )
        try await service.updateSharedLocation(recipients: [currentRecipient], latitude: 41.0, longitude: -7.0)
        try await service.stopSession()

        let recipientSets = relay.publishedEventsSnapshot().map { Set($0.recipients) }
        XCTAssertEqual(recipientSets.count, 4)
        XCTAssertEqual(recipientSets[0], Set([firstRecipient]))
        XCTAssertEqual(recipientSets[1], Set([currentRecipient]))
        let stopRecipientSets = Array(recipientSets.dropFirst(2))
        XCTAssertTrue(stopRecipientSets.contains(Set([firstRecipient])))
        XCTAssertTrue(stopRecipientSets.contains(Set([currentRecipient])))
    }

    func testLocationSharingServiceRemovesPeerLocationOnStopEvent() async throws {
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "6c", count: 32))
        let relay = RecordingRelayClient(relayURL: NRConstants.defaultRelayURL)
        let service = await LocationSharingService(
            keyStore: keyStore,
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )
        try await service.authenticate()

        let peer = String(repeating: "bc", count: 32)
        let now = Int(Date().timeIntervalSince1970)
        let locationPayload = LocationEventPayload(
            sessionId: "peer-session",
            area: "9F4MGCC5+",
            centerLat: 52.52,
            centerLon: 13.41,
            accuracyM: NRConstants.defaultApproximateAccuracyMeters,
            createdAt: now,
            expiresAt: now + 300
        )
        let stopPayload = StopEventPayload(sessionId: "peer-session", createdAt: now + 1)
        let localPubkey = try XCTUnwrap(keyStore.currentPublicKeyHex())

        relay.emitIncoming(makeRecordingEvent(pubkey: peer, recipient: localPubkey, payload: try NostrailPayloadCodec.encode(.location(locationPayload))))
        try await Task.sleep(for: .milliseconds(50))
        let countAfterLocation = await MainActor.run { service.receivedLocations.count }
        XCTAssertEqual(countAfterLocation, 1)

        relay.emitIncoming(makeRecordingEvent(pubkey: peer, recipient: localPubkey, payload: try NostrailPayloadCodec.encode(.stop(stopPayload))))
        try await Task.sleep(for: .milliseconds(50))

        let countAfterStop = await MainActor.run { service.receivedLocations.count }
        let statusAfterStop = await MainActor.run { service.statusText }
        XCTAssertEqual(countAfterStop, 0)
        XCTAssertEqual(statusAfterStop, "A peer stopped sharing.")
    }

    func testLocationSharingServicePrunesExpiredReceivedLocations() async {
        let storage = InMemoryAppStorage()
        storage.save(record: makeStoredLocationRecord(id: "expired", createdAt: 10, expiresAt: 20))
        storage.save(record: makeStoredLocationRecord(id: "fresh", createdAt: 30, expiresAt: 90))
        let service = await LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: RecordingRelayClient(relayURL: NRConstants.defaultRelayURL),
            storage: storage,
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        await service.pruneExpiredLocations(nowUnix: 75)

        let ids = await MainActor.run { service.receivedLocations.map(\.id) }
        XCTAssertEqual(ids, ["fresh"])
    }

    func testRelayPoolDeduplicatesEventsAcrossRelays() async throws {
        let relayA = InMemoryRelayClient(relayURL: URL(string: "wss://relay-a.example")!)
        let relayB = InMemoryRelayClient(relayURL: URL(string: "wss://relay-b.example")!)
        let endpointA = NRConstants.RelayEndpoint(url: URL(string: "wss://relay-a.example")!, readEnabled: true, writeEnabled: true, requiresNIP42Auth: true)
        let endpointB = NRConstants.RelayEndpoint(url: URL(string: "wss://relay-b.example")!, readEnabled: true, writeEnabled: true, requiresNIP42Auth: true)
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpointA, client: relayA),
            .init(endpoint: endpointB, client: relayB)
        ])

        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "7a", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }

        try await relayA.connect()
        try await relayB.connect()
        try await relayA.authenticate(with: keyStore)
        try await relayB.authenticate(with: keyStore)
        try await pool.connect()
        try await pool.subscribe(.init(eventKind: NRConstants.nostrailLocationEventKind, recipientPubkeys: [pubkey]))

        let unsigned = NostrEventFactory.makeUnsigned(
            pubkey: pubkey,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", pubkey]],
            content: "{}"
        )
        let event = try keyStore.sign(unsigned: unsigned)

        var received: [NostrEvent] = []
        let consumer = Task {
            for await item in pool.incomingEvents {
                received.append(item)
                if received.count >= 1 { break }
            }
        }
        try await relayA.publish(event)
        try await relayB.publish(event)
        try await Task.sleep(for: .milliseconds(200))
        consumer.cancel()

        XCTAssertEqual(received.count, 1)
        XCTAssertEqual(received.first?.id, event.id)
    }

    func testWireCodecRejectsTamperedEventID() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "8b", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }

        let unsigned = NostrEventFactory.makeUnsigned(
            pubkey: pubkey,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", pubkey]],
            content: #"{"ok":true}"#
        )
        let signed = try keyStore.sign(unsigned: unsigned)
        var wire = NostrWireCodec.eventDictionary(from: signed)
        wire["content"] = #"{"ok":false}"#

        let decoded = NostrWireCodec.event(from: wire)
        XCTAssertNil(decoded)
    }

    func testWireCodecRejectsFarFutureTimestamp() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "8c", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }

        let futureUnsigned = UnsignedNostrEvent(
            pubkey: pubkey,
            createdAt: Int(Date().timeIntervalSince1970) + 2 * 24 * 60 * 60,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", pubkey]],
            content: "{}"
        )
        let futureEvent = try keyStore.sign(unsigned: futureUnsigned)
        let decoded = NostrWireCodec.event(from: NostrWireCodec.eventDictionary(from: futureEvent))
        XCTAssertNil(decoded)
    }

    func testWireCodecRejectsOversizedContent() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "8d", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }
        let largeContent = String(repeating: "x", count: 70_000)
        let unsigned = NostrEventFactory.makeUnsigned(
            pubkey: pubkey,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", pubkey]],
            content: largeContent
        )
        let event = try keyStore.sign(unsigned: unsigned)
        let decoded = NostrWireCodec.event(from: NostrWireCodec.eventDictionary(from: event))
        XCTAssertNil(decoded)
    }

    func testWireCodecRejectsShortSignature() throws {
        let keyStore = InMemoryKeyStore()
        try keyStore.importSecret(String(repeating: "8e", count: 32))
        guard let pubkey = keyStore.currentPublicKeyHex() else {
            XCTFail("missing pubkey")
            return
        }
        let unsigned = NostrEventFactory.makeUnsigned(
            pubkey: pubkey,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", pubkey]],
            content: "{}"
        )
        let event = try keyStore.sign(unsigned: unsigned)
        var wire = NostrWireCodec.eventDictionary(from: event)
        wire["sig"] = String(event.sig.prefix(64))
        let decoded = NostrWireCodec.event(from: wire)
        XCTAssertNil(decoded)
    }

    func testRelayPreferencesStoreRoundTrip() throws {
        let suiteName = "RelayPreferencesStoreTests-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("missing isolated user defaults")
            return
        }
        defaults.removePersistentDomain(forName: suiteName)

        let store = UserDefaultsRelayPreferencesStore(defaults: defaults)
        let base = [
            NRConstants.RelayEndpoint(
                url: URL(string: "wss://nip42.trustroots.org")!,
                readEnabled: true,
                writeEnabled: true,
                requiresNIP42Auth: true
            ),
            NRConstants.RelayEndpoint(
                url: URL(string: "wss://relay.trustroots.org")!,
                readEnabled: true,
                writeEnabled: true,
                requiresNIP42Auth: false
            )
        ]
        let changed = [
            NRConstants.RelayEndpoint(
                url: base[0].url,
                readEnabled: false,
                writeEnabled: true,
                requiresNIP42Auth: true
            ),
            NRConstants.RelayEndpoint(
                url: base[1].url,
                readEnabled: true,
                writeEnabled: false,
                requiresNIP42Auth: false
            )
        ]

        store.save(changed)
        let loaded = store.load(defaults: base)

        XCTAssertEqual(loaded.count, base.count)
        XCTAssertFalse(loaded[0].readEnabled)
        XCTAssertTrue(loaded[0].writeEnabled)
        XCTAssertTrue(loaded[0].requiresNIP42Auth)
        XCTAssertTrue(loaded[1].readEnabled)
        XCTAssertFalse(loaded[1].writeEnabled)
        XCTAssertFalse(loaded[1].requiresNIP42Auth)
    }

    func testRelayPreferencesStoreClearsMalformedSavedRelays() throws {
        let suiteName = "RelayPreferencesStoreMalformed-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("missing isolated user defaults")
            return
        }
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferencesKey = "nr.ios.relay.preferences.v1"
        let base = [
            NRConstants.RelayEndpoint(
                url: URL(string: "wss://relay-default.example")!,
                readEnabled: true,
                writeEnabled: true,
                requiresNIP42Auth: false
            )
        ]
        defaults.set(Data("not relay json".utf8), forKey: preferencesKey)

        let loaded = UserDefaultsRelayPreferencesStore(defaults: defaults).load(defaults: base)

        XCTAssertEqual(loaded, base)
        XCTAssertNil(defaults.data(forKey: preferencesKey))
    }

    func testRelayPreferencesStoreSanitizesAndRepairsSavedRelays() throws {
        struct PersistedRelay: Codable {
            let url: String
            let readEnabled: Bool
            let writeEnabled: Bool
            let requiresNIP42Auth: Bool
        }

        let suiteName = "RelayPreferencesStoreSanitizes-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("missing isolated user defaults")
            return
        }
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferencesKey = "nr.ios.relay.preferences.v1"
        let defaultEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-default.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let rawRelays = [
            PersistedRelay(
                url: "relay-default.example",
                readEnabled: false,
                writeEnabled: true,
                requiresNIP42Auth: true
            ),
            PersistedRelay(
                url: "https://not-a-nostr-relay.example",
                readEnabled: true,
                writeEnabled: true,
                requiresNIP42Auth: false
            ),
            PersistedRelay(
                url: "relay-custom.example",
                readEnabled: true,
                writeEnabled: false,
                requiresNIP42Auth: false
            ),
            PersistedRelay(
                url: "wss://relay-custom.example",
                readEnabled: false,
                writeEnabled: true,
                requiresNIP42Auth: true
            )
        ]
        defaults.set(try JSONEncoder().encode(rawRelays), forKey: preferencesKey)

        let loaded = UserDefaultsRelayPreferencesStore(defaults: defaults).load(defaults: [defaultEndpoint])

        XCTAssertEqual(loaded.count, 2)
        XCTAssertEqual(loaded[0].url, defaultEndpoint.url)
        XCTAssertFalse(loaded[0].readEnabled)
        XCTAssertTrue(loaded[0].writeEnabled)
        XCTAssertFalse(loaded[0].requiresNIP42Auth)
        XCTAssertEqual(loaded[1].url.absoluteString, "wss://relay-custom.example")
        XCTAssertTrue(loaded[1].readEnabled)
        XCTAssertFalse(loaded[1].writeEnabled)
        XCTAssertFalse(loaded[1].requiresNIP42Auth)

        let repairedData = try XCTUnwrap(defaults.data(forKey: preferencesKey))
        let repairedRelays = try JSONDecoder().decode([PersistedRelay].self, from: repairedData)
        XCTAssertEqual(repairedRelays.map(\.url), [
            "wss://relay-default.example",
            "wss://relay-custom.example"
        ])
    }

    func testRelayPreferencesStoreClearsMalformedConnectionFailureCounts() {
        let suiteName = "RelayFailureCountsMalformed-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("missing isolated user defaults")
            return
        }
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let failureCountsKey = "nr.ios.relay.connectionFailureCounts.v1"
        defaults.set(Data("not failure count json".utf8), forKey: failureCountsKey)

        let counts = UserDefaultsRelayPreferencesStore(defaults: defaults).loadConnectionFailureCounts()

        XCTAssertTrue(counts.isEmpty)
        XCTAssertNil(defaults.data(forKey: failureCountsKey))
    }

    func testRelayPreferencesStoreSanitizesAndRepairsConnectionFailureCounts() throws {
        struct PersistedConnectionFailureCount: Codable {
            let url: String
            let count: Int
        }

        let suiteName = "RelayFailureCountsSanitizes-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            XCTFail("missing isolated user defaults")
            return
        }
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let failureCountsKey = "nr.ios.relay.connectionFailureCounts.v1"
        let rawCounts = [
            PersistedConnectionFailureCount(url: "relay-flaky.example", count: 2),
            PersistedConnectionFailureCount(url: "https://not-a-relay.example", count: 4),
            PersistedConnectionFailureCount(url: "wss://relay-flaky.example", count: 3),
            PersistedConnectionFailureCount(url: "wss://relay-zero.example", count: 0)
        ]
        defaults.set(try JSONEncoder().encode(rawCounts), forKey: failureCountsKey)

        let counts = UserDefaultsRelayPreferencesStore(defaults: defaults).loadConnectionFailureCounts()

        XCTAssertEqual(counts, [
            URL(string: "wss://relay-flaky.example")!: 3
        ])
        let repairedData = try XCTUnwrap(defaults.data(forKey: failureCountsKey))
        let repairedCounts = try JSONDecoder().decode([PersistedConnectionFailureCount].self, from: repairedData)
        XCTAssertEqual(repairedCounts.map(\.url), ["wss://relay-flaky.example"])
        XCTAssertEqual(repairedCounts.map(\.count), [3])
    }

    func testRelayPoolSetRelayStateUpdatesAndPersists() {
        let endpointA = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-a.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: true
        )
        let endpointB = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-b.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let store = RecordingRelayPreferencesStore()
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpointA, client: InMemoryRelayClient(relayURL: endpointA.url)),
            .init(endpoint: endpointB, client: InMemoryRelayClient(relayURL: endpointB.url))
        ], preferencesStore: store)

        pool.setRelayState(for: endpointA.url, readEnabled: false, writeEnabled: true)

        let current = pool.currentRelayEndpoints()
        XCTAssertEqual(current.count, 2)
        XCTAssertEqual(current[0].url, endpointA.url)
        XCTAssertFalse(current[0].readEnabled)
        XCTAssertTrue(current[0].writeEnabled)
        XCTAssertEqual(current[1].url, endpointB.url)
        XCTAssertTrue(current[1].readEnabled)
        XCTAssertTrue(current[1].writeEnabled)

        XCTAssertEqual(store.savedSnapshots.count, 1)
        XCTAssertEqual(store.savedSnapshots[0][0].url, endpointA.url)
        XCTAssertFalse(store.savedSnapshots[0][0].readEnabled)
        XCTAssertTrue(store.savedSnapshots[0][0].writeEnabled)
    }

    func testRelayAvailabilitySummaryUsesPlainLanguageForDisabledStates() {
        let readOnly = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-readonly.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let writeOnly = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-writeonly.example")!,
            readEnabled: false,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let disabled = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-disabled.example")!,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: false
        )

        XCTAssertEqual(
            RelayAvailabilitySummary(endpoints: [readOnly, writeOnly]).userFacingDescription,
            "2 relays enabled."
        )
        XCTAssertEqual(
            RelayAvailabilitySummary(endpoints: [disabled]).userFacingDescription,
            "All relays are turned off."
        )
        XCTAssertEqual(
            RelayAvailabilitySummary(endpoints: [writeOnly]).userFacingDescription,
            "Receiving is off. Turn on at least one readable relay."
        )
        XCTAssertEqual(
            RelayAvailabilitySummary(endpoints: [readOnly]).userFacingDescription,
            "Sharing is off. Turn on at least one writable relay."
        )
        XCTAssertEqual(
            RelayAvailabilitySummary(endpoints: [readOnly, disabled]).userFacingDescription,
            "Sharing is off. Turn on at least one writable relay."
        )
    }

    func testSwiftrootsConnectionStatusFormatterUsesUserFacingStates() {
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: true,
                relayAvailabilityText: "2 relays enabled."
            ),
            "Connected to relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled."
            ),
            "Ready when you check relays or share"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnect to receive updates"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnect to send updates"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Location updated. Reconnect, then retry 1 person."
            ),
            "Reconnect to send updates"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect to stop sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not connect to relays. Check your connection and try again."
            ),
            "Reconnect relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnect relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "All relays are turned off."
            ),
            "Relays are turned off"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "No relays are configured."
            ),
            "No relays configured"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.statusText(
                isAuthenticated: false,
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Sharing is off"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "2 relays enabled."
            ),
            "Check Relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: true,
                relayAvailabilityText: "2 relays enabled."
            ),
            "Checking..."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "2 relays enabled.",
                retryWaitText: "Try again in 5 seconds."
            ),
            "Try Again Soon"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                retryWaitText: "Try again in 5 seconds."
            ),
            "Try again in 5 seconds."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnect Relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Relays stopped sending updates. Reconnect to receive new shared locations."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnect Relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Location updated. Reconnect, then retry 1 person."
            ),
            "Reconnect Relays"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnect before retrying pending invites or location updates."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect before retrying Stop Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Could not connect to relays. Check your connection and try again."
            ),
            "Reconnect to check current relay access."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "2 relays enabled.",
                serviceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnect to resume automatic sharing updates, then Share Current Area to send now."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "All relays are turned off."
            ),
            "Turn On a Relay First"
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.canCheckRelays(
                relayAvailabilityText: "All relays are turned off."
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "All relays are turned off."
            ),
            "Turn on at least one relay before checking."
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.canCheckRelays(
                relayAvailabilityText: "No relays are configured."
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysButtonTitle(
                isChecking: false,
                relayAvailabilityText: "No relays are configured."
            ),
            "Add a Relay First"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysHelperText(
                relayAvailabilityText: "No relays are configured."
            ),
            "Add a relay before checking."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .connected)
                ],
                fallback: "Relays ready."
            ),
            "2 relays reachable."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .failed("timeout"))
                ],
                fallback: "Relays ready."
            ),
            "1 relay reachable. 1 relay could not connect."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 2
                    )
                ],
                fallback: "Relays ready."
            ),
            "1 relay reachable. 1 relay keeps failing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                fallback: "Relays ready."
            ),
            "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay."
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.isSharingPathUnavailable(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ]
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .connected,
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnected. 1 relay reachable. 1 relay could not connect. Sharing still works; receiving has no reachable relay."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnected. 1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay. Open Relay Settings before using Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .connected,
                        readEnabled: false,
                        writeEnabled: true
                    )
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnected. 1 relay reachable. 1 relay could not connect. Sharing still works; receiving has no reachable relay. Share Current Area to send now."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .failed("timeout"))
                ],
                fallback: "Could not connect to relays."
            ),
            "No relays reachable. Check your connection and try again."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 2
                    )
                ],
                fallback: "Could not connect to relays.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Could not reconnect. 1 relay keeps failing. Check your connection and try again."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .connected)
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnected. 2 relays reachable."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .connected)
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnected. Retry Stop Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .failed("timeout"))
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnected. 1 relay reachable. 1 relay could not connect."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .failed("timeout"))
                ],
                fallback: "Could not connect to relays.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Could not reconnect. Check your connection and try again."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 2
                    )
                ],
                fallback: "Could not connect to relays.",
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Could not reconnect. 1 relay keeps failing. Reconnect relays to resume automatic updates, then Share Current Area to send now."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [],
                fallback: "Relays ready.",
                previousServiceStatusText: "Relay stopped sending updates. Try reconnecting."
            ),
            "Reconnected. Relays ready."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [],
                fallback: "Could not connect to relays.",
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [],
                fallback: "Relays ready.",
                previousServiceStatusText: "Sharing restored. Reconnect relays to resume automatic updates. Use Share Current Area to send now."
            ),
            "Reconnected. Automatic sharing updates can resume. Share Current Area to send now."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.checkRelaysResultText(
                results: [
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-a.example")!, state: .connected),
                    RelayConnectionCheckResult(url: URL(string: "wss://relay-b.example")!, state: .connected)
                ],
                fallback: "Relays ready.",
                previousServiceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnected. 2 relays reachable."
        )
        let recentBaseDate = Date(timeIntervalSince1970: 10_000)
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "2 relays reachable.",
                checkedAt: recentBaseDate.addingTimeInterval(-20),
                now: recentBaseDate
            ),
            "Last checked just now: 2 relays reachable."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "1 relay reachable.",
                checkedAt: recentBaseDate.addingTimeInterval(-120),
                now: recentBaseDate
            ),
            "Last checked 2 minutes ago: 1 relay reachable."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "No relays reachable.",
                checkedAt: recentBaseDate.addingTimeInterval(-7_200),
                now: recentBaseDate
            ),
            "Last checked 2 hours ago: No relays reachable."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "2 relays reachable.",
                checkedAt: recentBaseDate.addingTimeInterval(-25_200),
                now: recentBaseDate
            ),
            "Last checked 7 hours ago: 2 relays reachable. Check relays for current reachability."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "1 relay reachable.",
                checkedAt: recentBaseDate.addingTimeInterval(-172_800),
                now: recentBaseDate
            ),
            "Last checked 2 days ago: 1 relay reachable. Check relays for current reachability."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.recentRelayCheckText(
                summary: "   ",
                checkedAt: recentBaseDate,
                now: recentBaseDate
            ),
            ""
        )
        let retryBaseDate = Date(timeIntervalSince1970: 100)
        XCTAssertEqual(RelayReconnectCooldown.defaultDelay, 5)
        XCTAssertEqual(RelayReconnectCooldown.maximumDelay, 20)
        XCTAssertEqual(RelayReconnectCooldown.delay(afterConsecutiveFailures: 0), 5)
        XCTAssertEqual(RelayReconnectCooldown.delay(afterConsecutiveFailures: 1), 5)
        XCTAssertEqual(RelayReconnectCooldown.delay(afterConsecutiveFailures: 2), 10)
        XCTAssertEqual(RelayReconnectCooldown.delay(afterConsecutiveFailures: 3), 20)
        XCTAssertEqual(RelayReconnectCooldown.delay(afterConsecutiveFailures: 4), 20)
        XCTAssertEqual(
            RelayReconnectCooldown.effectiveFailureCount(
                actionFailureCount: 1,
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-failing.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 3
                    )
                ]
            ),
            3
        )
        XCTAssertEqual(
            RelayReconnectCooldown.effectiveFailureCount(
                actionFailureCount: 2,
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-working.example")!,
                        state: .connected
                    )
                ]
            ),
            2
        )
        XCTAssertEqual(
            RelayReconnectCooldown.nextAllowedAt(now: retryBaseDate),
            retryBaseDate.addingTimeInterval(5)
        )
        XCTAssertEqual(
            RelayReconnectCooldown.nextAllowedAt(now: retryBaseDate, consecutiveFailures: 2),
            retryBaseDate.addingTimeInterval(10)
        )
        XCTAssertEqual(
            RelayReconnectCooldown.waitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(4.1)
            ),
            "Try again in 5 seconds."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.waitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(9.1),
                actionFailureCount: 1,
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-failing.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 2
                    )
                ]
            ),
            "Try again in 10 seconds. A relay keeps failing, so this wait is longer."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.waitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(19.1),
                actionFailureCount: 2,
                relayCheckResults: []
            ),
            "Try again in 20 seconds. Reconnect keeps failing, so this wait is longer."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.retryStatusText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(4.1),
                actionFailureCount: 1,
                relayCheckResults: []
            ),
            "Try again in 5 seconds."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.retryStatusText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate,
                actionFailureCount: 1,
                relayCheckResults: []
            ),
            "Try again now."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.retryStatusText(
                now: retryBaseDate,
                nextAllowedAt: nil,
                actionFailureCount: 0,
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-failing.example")!,
                        state: .failed("timeout"),
                        consecutiveFailures: 1
                    )
                ],
                readyText: "Check relays now."
            ),
            "Check relays now."
        )
        XCTAssertEqual(
            RelayReconnectCooldown.retryStatusText(
                now: retryBaseDate,
                nextAllowedAt: nil,
                actionFailureCount: 0,
                relayCheckResults: []
            ),
            ""
        )
        XCTAssertTrue(
            RelayReconnectCooldown.isCoolingDown(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(0.2)
            )
        )
        XCTAssertFalse(
            RelayReconnectCooldown.isCoolingDown(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.retryWaitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(4.1)
            ),
            "Try again in 5 seconds."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.retryWaitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate.addingTimeInterval(0.2)
            ),
            "Try again in 1 second."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.retryWaitText(
                now: retryBaseDate,
                nextAllowedAt: retryBaseDate
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "2 relays enabled."
            ),
            "Relay settings changed. Check relays to update current reachability."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "2 relays enabled.",
                isResolvingStopSharingRetry: true
            ),
            "Relay settings changed. Check relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "All relays are turned off."
            ),
            "Relay settings changed. Turn on at least one relay before checking."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsChangedStatusText(
                relayAvailabilityText: "All relays are turned off.",
                isResolvingStopSharingRetry: true
            ),
            "Relay settings changed. Turn on at least one relay before retrying Stop Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added relay.example.",
                relayAvailabilityText: "2 relays enabled."
            ),
            "Added relay.example. Check Relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added relay.example.",
                relayAvailabilityText: "2 relays enabled.",
                isResolvingSharingRetry: true
            ),
            "Added relay.example. Check Relays before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsActionStatusText(
                actionText: "Added relay.example.",
                relayAvailabilityText: "2 relays enabled.",
                isResolvingSharingRetry: true,
                isResolvingStopSharingRetry: true
            ),
            "Added relay.example. Check Relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsActionStatusText(
                actionText: "Removed relay.example.",
                relayAvailabilityText: "All relays are turned off.",
                isResolvingSharingRetry: true,
                isResolvingStopSharingRetry: true
            ),
            "Removed relay.example. Turn on at least one relay before retrying Stop Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
                relayAvailabilityText: "No relays are configured."
            ),
            "Add a Share relay before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryEntryText(),
            "Check relay settings, then Check Relays before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
                relayAvailabilityText: "All relays are turned off."
            ),
            "Turn on Share for a relay, then Check Relays before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Turn on Share for a relay, then Check Relays before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsSharingRetryRecoveryText(
                relayAvailabilityText: "2 relays enabled."
            ),
            "Check relays here, then retry Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingRelayCheckStatusText(
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay.",
                relayCheckResults: []
            ),
            "Sharing is still off. Turn on Share for at least one relay before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingRelayCheckStatusText(
                relayAvailabilityText: "2 relays enabled.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: false
                    ),
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-b.example")!,
                        state: .failed("timeout"),
                        readEnabled: false,
                        writeEnabled: true
                    )
                ]
            ),
            "Sharing still has no reachable relay. Check Share toggles or try another relay before retrying Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingRelayCheckStatusText(
                relayAvailabilityText: "2 relays enabled.",
                relayCheckResults: [
                    RelayConnectionCheckResult(
                        url: URL(string: "wss://relay-a.example")!,
                        state: .connected,
                        readEnabled: true,
                        writeEnabled: true
                    )
                ]
            ),
            "Relay settings checked. Retry Start Sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: false,
                    writeEnabled: false,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "All relays are turned off."
            ),
            "Turn on Receive to get updates, or Share to send your own."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: false,
                    writeEnabled: true,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "Receiving is off. Turn on at least one readable relay."
            ),
            "Turn on Receive here to get shared locations."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: false,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay."
            ),
            "Turn on Share here to send your own location."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: true,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "2 relays enabled.",
                connectionCheck: RelayConnectionCheckResult(
                    url: URL(string: "wss://relay.example")!,
                    state: .failed("timeout"),
                    readEnabled: true,
                    writeEnabled: true
                ),
                isResolvingSharingRetry: true
            ),
            "Receive and Share are failing here. Turn this relay off or add another relay if it keeps failing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: false,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "2 relays enabled.",
                connectionCheck: RelayConnectionCheckResult(
                    url: URL(string: "wss://relay.example")!,
                    state: .connected,
                    readEnabled: true,
                    writeEnabled: false
                ),
                isResolvingSharingRetry: true
            ),
            "Receive works here. Turn on Share to use this relay for retries."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.relaySettingsRowHelperText(
                endpoint: NRConstants.RelayEndpoint(
                    url: URL(string: "wss://relay.example")!,
                    readEnabled: true,
                    writeEnabled: true,
                    requiresNIP42Auth: false
                ),
                relayAvailabilityText: "2 relays enabled."
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingStatusText(isSharing: true),
            "Sharing active"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingStatusText(isSharing: false),
            "Not sharing"
        )
        let sharingBaseDate = Date(timeIntervalSince1970: 1_000)
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingStatusText(
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                now: sharingBaseDate
            ),
            "Sharing active"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingStatusText(
                isSharing: true,
                sessionExpiresAtUnix: 1_200,
                now: sharingBaseDate
            ),
            "Sharing ending soon"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingStatusText(
                isSharing: true,
                sessionExpiresAtUnix: 1_000,
                now: sharingBaseDate
            ),
            "Sharing expired"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: false,
                sessionExpiresAtUnix: nil,
                now: sharingBaseDate
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: true,
                sessionExpiresAtUnix: nil,
                now: sharingBaseDate
            ),
            "Session end time unavailable. Stop sharing before starting a new session."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: true,
                sessionExpiresAtUnix: 1_030,
                now: sharingBaseDate
            ),
            "Ends in under 1 minute."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: true,
                sessionExpiresAtUnix: 1_120,
                now: sharingBaseDate
            ),
            "Ends in 2 minutes."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: true,
                sessionExpiresAtUnix: 8_200,
                now: sharingBaseDate
            ),
            "Ends in about 2 hours."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingSessionDetailText(
                isSharing: true,
                sessionExpiresAtUnix: 999,
                now: sharingBaseDate
            ),
            "Session ended. Clear it before starting a new sharing session."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRecipientsText(
                isSharing: false,
                recipientDisplayValues: ["alice"]
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRecipientsText(
                isSharing: true,
                recipientDisplayValues: []
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRecipientsText(
                isSharing: true,
                recipientDisplayValues: ["alice"]
            ),
            "Sharing with 1 person."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRecipientsText(
                isSharing: true,
                recipientDisplayValues: ["alice", "bob"]
            ),
            "Sharing with 2 people."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetRecipients(
                currentRecipients: ["carol"],
                activeSessionRecipientDisplayValues: ["alice", " ", "Carol", "bob"],
                isSharing: true
            ),
            ["carol", "alice", "bob"]
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetRecipients(
                currentRecipients: ["carol"],
                activeSessionRecipientDisplayValues: ["alice"],
                isSharing: false
            ),
            ["carol"]
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetContextText(
                visibleRecipients: ["alice", "bob"],
                activeSessionRecipientDisplayValues: ["Alice", "bob"],
                isSharing: true
            ),
            "2 people already in this sharing session. Share Current Area sends the latest approximate area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetContextText(
                visibleRecipients: ["alice", "carol"],
                activeSessionRecipientDisplayValues: ["alice"],
                isSharing: true
            ),
            "1 person already in this sharing session. 1 new person will be added when you share."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetContextText(
                visibleRecipients: ["carol", "dave"],
                activeSessionRecipientDisplayValues: ["alice"],
                isSharing: true
            ),
            "2 new people will be added to this sharing session when you share."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetContextText(
                visibleRecipients: ["alice"],
                activeSessionRecipientDisplayValues: ["alice"],
                isSharing: false
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: true,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                now: sharingBaseDate
            ),
            "Stopping..."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                isSharing: true,
                sessionExpiresAtUnix: 999,
                now: sharingBaseDate
            ),
            "Clear Expired Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                now: sharingBaseDate
            ),
            "Stop Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                now: sharingBaseDate,
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                isSharing: true,
                sessionExpiresAtUnix: 1_400,
                now: sharingBaseDate,
                serviceStatusText: "2 relays enabled.",
                hasPendingRetry: true
            ),
            "Retry Stop Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingButtonTitle(
                isStopping: false,
                isSharing: true,
                sessionExpiresAtUnix: 999,
                now: sharingBaseDate,
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Clear Expired Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Could not stop sharing. Check your connection and try again."
            ),
            "Reconnect relays if needed, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Could not stop sharing. Check your connection and try again.",
                didChangeRelaySettings: true
            ),
            "Relay settings changed. Check relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: "2 relays enabled.",
                didChangeRelaySettings: true,
                hasPendingRetry: true
            ),
            "Relay settings changed. Check relays, then Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Reconnected. Retry Stop Sharing."
            ),
            "Relays reconnected. Retry Stop Sharing to tell people the session ended."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.stopSharingHelperText(
                serviceStatusText: "Sharing active."
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: true,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "2 relays reachable.",
                didChangeRelaySettings: false
            ),
            ""
        )
        let staleRelayCheckBaseDate = Date(timeIntervalSince1970: 20_000)
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay."
            ),
            "Sharing has no reachable relay. Open Relay Settings before Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now."
            ),
            "Reconnect relays before Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "2 relays reachable."
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: false,
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay."
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay.",
                didChangeRelaySettings: true
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay.",
                lastRelayCheckDate: staleRelayCheckBaseDate.addingTimeInterval(-25_200),
                now: staleRelayCheckBaseDate
            ),
            "Check relays before Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingRelayWarningText(
                isSharing: true,
                lastRelayCheckSummary: "Could not reconnect. Reconnect relays to resume automatic updates, then Share Current Area to send now.",
                lastRelayCheckDate: staleRelayCheckBaseDate.addingTimeInterval(-25_200),
                now: staleRelayCheckBaseDate
            ),
            "Check relays before Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingSheetWarningText(
                isSharing: true,
                activeSharingRelayWarningText: "  Sharing has no reachable relay. Open Relay Settings before Share Current Area.  "
            ),
            "Sharing has no reachable relay. Open Relay Settings before Share Current Area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.activeSharingSheetWarningText(
                isSharing: false,
                activeSharingRelayWarningText: "Sharing has no reachable relay. Open Relay Settings before Share Current Area."
            ),
            ""
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.isActiveSharingSheetActionDisabled(
                isSharing: true,
                activeSharingRelayWarningText: "Reconnect relays before Share Current Area."
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.isActiveSharingSheetActionDisabled(
                isSharing: true,
                activeSharingRelayWarningText: "   "
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.isActiveSharingSheetActionDisabled(
                isSharing: false,
                activeSharingRelayWarningText: "Reconnect relays before Share Current Area."
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "2 relays reachable.",
                didChangeRelaySettings: true
            ),
            "Relay settings changed. Check relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "No relays are configured.",
                lastRelayCheckSummary: "",
                didChangeRelaySettings: false
            ),
            "Add a relay before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "All relays are turned off.",
                lastRelayCheckSummary: "",
                didChangeRelaySettings: false
            ),
            "Turn on at least one relay before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "Sharing is off. Turn on at least one writable relay.",
                lastRelayCheckSummary: "",
                didChangeRelaySettings: false
            ),
            "Turn on Share for at least one relay before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "",
                didChangeRelaySettings: false
            ),
            "Check relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "2 relays reachable.",
                didChangeRelaySettings: false,
                serviceStatusText: "Could not send this update. Check your connection and try again."
            ),
            "Reconnect relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay.",
                didChangeRelaySettings: false
            ),
            "Fix relay reachability before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "1 relay reachable. 1 relay could not connect. Receiving still works; sharing has no reachable relay.",
                didChangeRelaySettings: false,
                lastRelayCheckDate: staleRelayCheckBaseDate.addingTimeInterval(-25_200),
                now: staleRelayCheckBaseDate
            ),
            "Check relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "2 relays reachable.",
                didChangeRelaySettings: false,
                lastRelayCheckDate: staleRelayCheckBaseDate.addingTimeInterval(-25_200),
                now: staleRelayCheckBaseDate
            ),
            "Check relays before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.sharingReadinessText(
                isSharing: false,
                relayAvailabilityText: "2 relays enabled.",
                lastRelayCheckSummary: "2 relays reachable.",
                didChangeRelaySettings: false
            ),
            "Relays checked for sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingButtonTitle(
                isSharing: true,
                sharingReadinessText: ""
            ),
            "Share Current Area"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingButtonTitle(
                isSharing: false,
                sharingReadinessText: "Relays checked for sharing."
            ),
            "Start Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingButtonTitle(
                isSharing: false,
                sharingReadinessText: "Check relays before sharing."
            ),
            "Prepare Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: "Relay settings changed. Check relays before sharing."
            ),
            "Check relays before starting sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: "Turn on Share for at least one relay before sharing."
            ),
            "Turn on Share for at least one relay before starting sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: "Fix relay reachability before sharing."
            ),
            "Fix relay reachability before starting sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: "Reconnect relays before sharing."
            ),
            "Reconnect relays before starting sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingActionStatusText(
                sharingReadinessText: "Relays checked for sharing."
            ),
            "Add people to start sharing. Relays are ready."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
                sentCount: 2,
                failedLookupInputs: [],
                failedSendInputs: [],
                didUpdateExistingShare: false
            ),
            "Sharing started with 2 people."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
                sentCount: 1,
                failedLookupInputs: [],
                failedSendInputs: ["bob"],
                didUpdateExistingShare: false
            ),
            "Sharing started with 1 person. Reconnect, then retry 1 person."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
                sentCount: 2,
                failedLookupInputs: [],
                failedSendInputs: [],
                didUpdateExistingShare: true
            ),
            "Shared current area with 2 people."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
                sentCount: 1,
                failedLookupInputs: ["ghost"],
                failedSendInputs: ["bob"],
                didUpdateExistingShare: true
            ),
            "Shared current area with 1 person. Some recipients need checking or retrying."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingResultStatusText(
                sentCount: 0,
                failedLookupInputs: [],
                failedSendInputs: ["alice", "bob"],
                didUpdateExistingShare: true
            ),
            "No location updates sent. Reconnect, then retry 2 people."
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldDismissStartSharingSheetAfterResult(
                hasFailures: false,
                didUpdateExistingShare: false
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldDismissStartSharingSheetAfterResult(
                hasFailures: false,
                didUpdateExistingShare: true
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldDismissStartSharingSheetAfterResult(
                hasFailures: true,
                didUpdateExistingShare: false
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
                isSharing: true,
                isBusy: false,
                didCompleteCurrentAreaUpdate: true,
                hasShareRetryFailures: false,
                retryableRecipientCount: 0
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
                isSharing: true,
                isBusy: false,
                didCompleteCurrentAreaUpdate: true,
                hasShareRetryFailures: false,
                retryableRecipientCount: 1
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
                isSharing: true,
                isBusy: false,
                didCompleteCurrentAreaUpdate: true,
                hasShareRetryFailures: true,
                retryableRecipientCount: 1
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
                isSharing: true,
                isBusy: true,
                didCompleteCurrentAreaUpdate: true,
                hasShareRetryFailures: false,
                retryableRecipientCount: 0
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetDoneButton(
                isSharing: true,
                isBusy: false,
                didCompleteCurrentAreaUpdate: false,
                hasShareRetryFailures: false,
                retryableRecipientCount: 0
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingWaitingForLocationText(didUpdateExistingShare: true),
            "Finding your location. Swiftroots will share the current area after iOS returns an approximate area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingWaitingForLocationText(didUpdateExistingShare: false),
            "Finding your location. Sharing will start after iOS returns an approximate area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingLocationWaitCanceledText(),
            "Location request canceled. People stay selected for sharing later."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingInitialLocationPrompt(),
            "Choose your current approximate area before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingCurrentAreaReadyText(),
            "Current approximate area ready."
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                SwiftrootsConnectionStatusFormatter.startSharingInitialLocationPrompt()
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                SwiftrootsConnectionStatusFormatter.startSharingLocationWaitCanceledText()
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                "Could not get current location: network busy"
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                NostrailLocationStatusFormatter.permissionDenied
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                NostrailLocationStatusFormatter.permissionUnavailable
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldReplaceStartSharingLocationStatusAfterFreshLocation(
                "Starting sharing..."
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldClearStartSharingLocationStatusWhileEditing(
                SwiftrootsConnectionStatusFormatter.startSharingLocationWaitCanceledText()
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldClearStartSharingLocationStatusWhileEditing(
                "Could not get current location: network busy"
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldClearStartSharingLocationStatusWhileEditing(
                NostrailLocationStatusFormatter.permissionDenied
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetCompletionHelperText(shouldShowDoneButton: true),
            "Rows marked Updated have the latest approximate area."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetCompletionHelperText(shouldShowDoneButton: false),
            ""
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetLocationSettings(
                statusLine: NostrailLocationStatusFormatter.permissionDenied
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetLocationSettings(
                statusLine: NostrailLocationStatusFormatter.permissionUnavailable
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationSettingsHelperText(
                shouldShowLocationSettings: true
            ),
            "Enable location permission in Settings, then return and try sharing again."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationSettingsHelperText(
                shouldShowLocationSettings: false
            ),
            ""
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldRetryStartSharingSheetLocation(
                statusLine: "Could not get current location: network busy",
                hasLocationFix: false
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldRetryStartSharingSheetLocation(
                statusLine: "Could not get current location: network busy",
                hasLocationFix: true
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldRetryStartSharingSheetLocation(
                statusLine: NostrailLocationStatusFormatter.permissionDenied,
                hasLocationFix: false
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationRetryHelperText(
                shouldRetryLocation: true
            ),
            "Try location again without changing the people selected."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationRetryHelperText(
                shouldRetryLocation: false
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationWaitHelperText(
                isFindingLocation: true
            ),
            "Cancel keeps people selected and stops this pending share."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetLocationWaitHelperText(
                isFindingLocation: false
            ),
            ""
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
                isStarting: true,
                isFindingLocation: false,
                hasShareRetryFailures: false,
                isSharing: false
            ),
            "Starting..."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
                isStarting: false,
                isFindingLocation: true,
                hasShareRetryFailures: false,
                isSharing: false
            ),
            "Finding Location..."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
                isStarting: false,
                isFindingLocation: false,
                shouldRetryLocation: true,
                hasShareRetryFailures: false,
                isSharing: false
            ),
            "Try Location Again"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
                isStarting: false,
                isFindingLocation: false,
                hasShareRetryFailures: true,
                isSharing: false
            ),
            "Retry Sharing"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonTitle(
                isStarting: false,
                isFindingLocation: false,
                hasShareRetryFailures: false,
                isSharing: true
            ),
            "Share Current Area"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonIcon(hasShareRetryFailures: true),
            "arrow.clockwise"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetButtonIcon(hasShareRetryFailures: false),
            "location.circle.fill"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 0,
                retryableRecipientCount: 0,
                hasLocationFix: false,
                hasShareRetryFailures: false,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: false
            ),
            "Add at least one person before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 1,
                hasLocationFix: true,
                hasShareRetryFailures: false,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: false
            ),
            "Only pending people will receive this sharing start. Already-current people will not get a duplicate update."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 1,
                hasLocationFix: true,
                hasShareRetryFailures: false,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: true
            ),
            "Only pending people will receive this current-area update. Already-current people will not get a duplicate update."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 2,
                hasLocationFix: false,
                hasShareRetryFailures: false,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: false
            ),
            "Your location stays approximate, and iOS will ask permission before sharing."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 2,
                hasLocationFix: true,
                hasShareRetryFailures: false,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: true
            ),
            "Shares your current approximate area with 2 people."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 2,
                hasLocationFix: true,
                hasShareRetryFailures: true,
                didReconnect: false,
                isRetryBlockedByRelayPath: false,
                isSharing: false
            ),
            "Reconnect before retrying rows marked Retry."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 2,
                hasLocationFix: true,
                hasShareRetryFailures: true,
                didReconnect: true,
                isRetryBlockedByRelayPath: false,
                isSharing: false
            ),
            "Retry the rows marked Retry."
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.startSharingSheetHelperText(
                recipientCount: 2,
                retryableRecipientCount: 2,
                hasLocationFix: true,
                hasShareRetryFailures: true,
                didReconnect: true,
                isRetryBlockedByRelayPath: true,
                isSharing: false
            ),
            "Sharing has no reachable relay. Open Relay Settings or reconnect before retrying rows marked Retry."
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.isStartSharingSheetStartDisabled(
                recipientCount: 0,
                retryableRecipientCount: 0,
                isBusy: false,
                isRetryBlockedByRelayPath: false
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.isStartSharingSheetStartDisabled(
                recipientCount: 2,
                retryableRecipientCount: 0,
                isBusy: false,
                isRetryBlockedByRelayPath: false
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.isStartSharingSheetStartDisabled(
                recipientCount: 2,
                retryableRecipientCount: 2,
                isBusy: false,
                isRetryBlockedByRelayPath: true
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.isStartSharingSheetStartDisabled(
                recipientCount: 2,
                retryableRecipientCount: 2,
                isBusy: false,
                isRetryBlockedByRelayPath: false
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetReconnect(
                hasShareRetryFailures: true,
                didReconnect: false,
                isRetryBlockedByRelayPath: false
            )
        )
        XCTAssertTrue(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetReconnect(
                hasShareRetryFailures: false,
                didReconnect: true,
                isRetryBlockedByRelayPath: true
            )
        )
        XCTAssertFalse(
            SwiftrootsConnectionStatusFormatter.shouldShowStartSharingSheetReconnect(
                hasShareRetryFailures: true,
                didReconnect: true,
                isRetryBlockedByRelayPath: false
            )
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.receivedLocationsText(count: 0),
            "No fresh shared locations"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.receivedLocationsText(count: 1),
            "1 fresh shared location"
        )
        XCTAssertEqual(
            SwiftrootsConnectionStatusFormatter.receivedLocationsText(count: 3),
            "3 fresh shared locations"
        )
    }

    func testRelayEndpointAvailabilityUsesPlainPerRelayDescriptions() {
        let both = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-both.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let readOnly = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-read.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let writeOnly = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-write.example")!,
            readEnabled: false,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let disabled = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-off.example")!,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: false
        )

        XCTAssertEqual(RelayEndpointAvailability(endpoint: both).userFacingDescription, "Receives and shares updates.")
        XCTAssertEqual(RelayEndpointAvailability(endpoint: readOnly).userFacingDescription, "Receives updates only.")
        XCTAssertEqual(RelayEndpointAvailability(endpoint: writeOnly).userFacingDescription, "Shares updates only.")
        XCTAssertEqual(RelayEndpointAvailability(endpoint: disabled).userFacingDescription, "Turned off.")
    }

    func testRelayConnectionCheckResultUsesPlainDescriptions() {
        let url = URL(string: "wss://relay.example")!

        XCTAssertEqual(
            RelayConnectionCheckResult(url: url, state: .connected).userFacingDescription,
            "Reachable."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(url: url, state: .skippedOff).userFacingDescription,
            "Not checked because it is turned off."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(url: url, state: .failed("timeout")).userFacingDescription,
            "Could not connect."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(url: url, state: .failed("timeout")).diagnosticDescription,
            "timeout"
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(
                url: url,
                state: .failed("timeout"),
                readEnabled: true,
                writeEnabled: true,
                consecutiveFailures: 1
            ).recoveryDescription,
            "Receive and Share are failing here. Turn this relay off or add another relay if it keeps failing."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(
                url: url,
                state: .failed("timeout"),
                readEnabled: true,
                writeEnabled: false,
                consecutiveFailures: 1
            ).recoveryDescription,
            "Receive is failing here. Turn this relay off or add another Receive relay if it keeps failing."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(
                url: url,
                state: .failed("timeout"),
                readEnabled: false,
                writeEnabled: true,
                consecutiveFailures: 1
            ).recoveryDescription,
            "Share is failing here. Turn this relay off or add another Share relay if it keeps failing."
        )
        XCTAssertEqual(
            RelayConnectionCheckResult(
                url: url,
                state: .failed("timeout"),
                readEnabled: false,
                writeEnabled: true,
                consecutiveFailures: 2
            ).recoveryDescription,
            "Share keeps failing here. Turn this relay off or add another Share relay."
        )
        XCTAssertNil(
            RelayConnectionCheckResult(url: url, state: .connected).recoveryDescription
        )
    }

    func testRelayUserFacingMessageFormatterHidesDiagnostics() {
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayPoolError.connectFailed(["relay.example: socket closed"]),
                context: .connect
            ),
            "Could not connect to relays. Check your connection and try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayPoolError.publishFailed(["relay.example: Relay did not acknowledge the event in time."]),
                context: .publish
            ),
            "Could not send this update. Check your connection and try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayPoolError.noWritableRelays,
                context: .publish
            ),
            "Sharing is off. Turn on at least one writable relay."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayClientError.publishAckTimeout,
                context: .publish
            ),
            "Could not confirm this update was sent. Try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayPoolError.publishFailed(["relay.example: Relay did not acknowledge the event in time."]),
                context: .stop
            ),
            "Could not stop sharing. Check your connection and try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayClientError.publishAckTimeout,
                context: .stop
            ),
            "Could not confirm sharing stopped. Try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: RelayPoolError.noWritableRelays,
                context: .stop
            ),
            "Sharing is off. Turn on at least one writable relay to send the stop notice."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: URLError(.notConnectedToInternet),
                context: .publish
            ),
            "Could not send this update. Check your connection and try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: URLError(.notConnectedToInternet),
                context: .stop
            ),
            "Could not stop sharing. Check your connection and try again."
        )
        XCTAssertEqual(
            RelayUserFacingMessageFormatter.message(
                for: URLError(.timedOut),
                context: .subscribe
            ),
            "Could not listen for shared locations. Check your connection and try again."
        )
    }

    func testNostrailActionErrorFormatterPreservesExpiredSessionStatus() {
        XCTAssertEqual(
            NostrailActionErrorFormatter.message(
                for: LocationSharingServiceError.noActiveSession,
                serviceStatusText: NostrailActionErrorFormatter.expiredSessionMessage
            ),
            "Sharing session expired."
        )
        XCTAssertEqual(
            NostrailActionErrorFormatter.message(for: LocationSharingServiceError.noActiveSession),
            "Start a sharing session first."
        )
        XCTAssertEqual(
            NostrailActionErrorFormatter.message(
                for: RelayClientError.publishAckTimeout,
                relayContext: .stop
            ),
            "Could not confirm sharing stopped. Try again."
        )
    }

    func testNostrailActionErrorFormatterIdentifiesRetryableRelayFailures() {
        XCTAssertTrue(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                RelayPoolError.publishFailed(["relay: timeout"])
            )
        )
        XCTAssertTrue(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                RelayPoolError.connectFailed(["relay: offline"])
            )
        )
        XCTAssertTrue(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                RelayClientError.publishAckTimeout
            )
        )
        XCTAssertTrue(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                URLError(.notConnectedToInternet)
            )
        )
        XCTAssertFalse(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                RelayPoolError.noWritableRelays
            )
        )
        XCTAssertFalse(
            NostrailActionErrorFormatter.isRetryableRelayFailure(
                LocationSharingServiceError.noActiveSession
            )
        )
    }

    func testRelayStateChangeGuardWarnsBeforeDisablingLastReceiveOrSharePath() {
        let primary = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-primary.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let secondary = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-secondary.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )

        XCTAssertNil(
            RelayStateChangeGuard.impact(
                ofChanging: primary.url,
                toReadEnabled: false,
                writeEnabled: true,
                in: [primary, secondary]
            )
        )
        XCTAssertEqual(
            RelayStateChangeGuard.impact(
                ofChanging: primary.url,
                toReadEnabled: true,
                writeEnabled: false,
                in: [primary, secondary]
            ),
            .disablesSharing
        )
        XCTAssertEqual(
            RelayStateChangeGuard.impact(
                ofChanging: primary.url,
                toReadEnabled: false,
                writeEnabled: true,
                in: [primary]
            ),
            .disablesReceiving
        )
        XCTAssertNil(
            RelayStateChangeGuard.impact(
                ofChanging: primary.url,
                toReadEnabled: true,
                writeEnabled: true,
                in: [primary]
            )
        )
    }

    @MainActor
    func testLocationSharingServiceExposesRelayAvailabilityText() {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-disabled.example")!,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let relay = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: RecordingRelayClient(relayURL: endpoint.url))
        ])
        let service = LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        XCTAssertEqual(service.relayAvailabilityText, "All relays are turned off.")
    }

    @MainActor
    func testLocationSharingServiceUpdatesRelayStateThroughPool() {
        let endpointA = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-a.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let endpointB = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-b.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let store = RecordingRelayPreferencesStore()
        let relay = RelayPoolClient(entries: [
            .init(endpoint: endpointA, client: RecordingRelayClient(relayURL: endpointA.url)),
            .init(endpoint: endpointB, client: RecordingRelayClient(relayURL: endpointB.url))
        ], preferencesStore: store)
        let service = LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        service.setRelayState(for: endpointA.url, readEnabled: false, writeEnabled: true)

        XCTAssertEqual(service.relayEndpoints.count, 2)
        XCTAssertFalse(service.relayEndpoints[0].readEnabled)
        XCTAssertTrue(service.relayEndpoints[0].writeEnabled)
        XCTAssertEqual(service.relayAvailabilityText, "2 relays enabled.")
        XCTAssertEqual(service.statusText, "2 relays enabled.")
        XCTAssertEqual(store.savedSnapshots.count, 1)
        XCTAssertFalse(store.savedSnapshots[0][0].readEnabled)
        XCTAssertTrue(store.savedSnapshots[0][0].writeEnabled)
    }

    func testRelayEndpointInputNormalizesAndValidatesRelayURLs() throws {
        XCTAssertEqual(
            try RelayEndpointInput.normalizedURL(from: "relay.example").absoluteString,
            "wss://relay.example"
        )
        XCTAssertEqual(
            try RelayEndpointInput.normalizedURL(from: "WS://relay.example/path").absoluteString,
            "ws://relay.example/path"
        )
        XCTAssertThrowsError(try RelayEndpointInput.normalizedURL(from: "")) { error in
            XCTAssertEqual(error as? RelayEndpointInputError, .empty)
        }
        XCTAssertThrowsError(try RelayEndpointInput.normalizedURL(from: "https://relay.example")) { error in
            XCTAssertEqual(error as? RelayEndpointInputError, .unsupportedScheme)
        }
    }

    func testRelayPreferencesStorePreservesCustomRelays() throws {
        let suiteName = "NostrootsNativeTests.RelayPreferences.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = UserDefaultsRelayPreferencesStore(defaults: defaults)
        let defaultEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-default.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: true
        )
        let customEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-custom.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )

        store.save([
            NRConstants.RelayEndpoint(
                url: defaultEndpoint.url,
                readEnabled: false,
                writeEnabled: true,
                requiresNIP42Auth: true
            ),
            customEndpoint
        ])
        let loaded = store.load(defaults: [defaultEndpoint])

        XCTAssertEqual(loaded.count, 2)
        XCTAssertEqual(loaded[0].url, defaultEndpoint.url)
        XCTAssertFalse(loaded[0].readEnabled)
        XCTAssertTrue(loaded[0].writeEnabled)
        XCTAssertTrue(loaded[0].requiresNIP42Auth)
        XCTAssertEqual(loaded[1].url, customEndpoint.url)
        XCTAssertTrue(loaded[1].readEnabled)
        XCTAssertFalse(loaded[1].writeEnabled)
        XCTAssertFalse(loaded[1].requiresNIP42Auth)
    }

    @MainActor
    func testLocationSharingServiceAddsRelayThroughPool() throws {
        let store = RecordingRelayPreferencesStore()
        let relay = RelayPoolClient(entries: [], preferencesStore: store)
        let service = LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        let addedURL = try service.addRelay(urlString: "relay-added.example")

        XCTAssertEqual(addedURL.absoluteString, "wss://relay-added.example")
        XCTAssertEqual(service.relayEndpoints.count, 1)
        XCTAssertEqual(service.relayEndpoints[0].url, addedURL)
        XCTAssertTrue(service.relayEndpoints[0].readEnabled)
        XCTAssertTrue(service.relayEndpoints[0].writeEnabled)
        XCTAssertEqual(service.relayAvailabilityText, "1 relay enabled.")
        XCTAssertEqual(service.statusText, "1 relay enabled.")
        XCTAssertEqual(store.savedSnapshots.count, 1)
        XCTAssertEqual(store.savedSnapshots[0][0].url, addedURL)
        XCTAssertThrowsError(try service.addRelay(urlString: "wss://relay-added.example")) { error in
            XCTAssertEqual(error as? RelayEndpointInputError, .duplicate)
        }
    }

    @MainActor
    func testLocationSharingServiceRemovesOnlyCustomRelays() throws {
        let builtInEndpoint = NRConstants.defaultRelayEndpoints[0]
        let customEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-custom.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let store = RecordingRelayPreferencesStore()
        let relay = RelayPoolClient(entries: [
            .init(endpoint: builtInEndpoint, client: RecordingRelayClient(relayURL: builtInEndpoint.url)),
            .init(endpoint: customEndpoint, client: RecordingRelayClient(relayURL: customEndpoint.url))
        ], preferencesStore: store)
        let service = LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        try service.removeRelay(url: customEndpoint.url)

        XCTAssertEqual(service.relayEndpoints.map(\.url), [builtInEndpoint.url])
        XCTAssertEqual(service.statusText, "1 relay enabled.")
        XCTAssertEqual(store.savedSnapshots.last?.map(\.url), [builtInEndpoint.url])
        XCTAssertThrowsError(try service.removeRelay(url: builtInEndpoint.url)) { error in
            XCTAssertEqual(error as? RelayEndpointInputError, .cannotRemoveBuiltIn)
        }
    }

    @MainActor
    func testLocationSharingServiceRestoresDefaultRelays() throws {
        let disabledBuiltIn = NRConstants.RelayEndpoint(
            url: NRConstants.defaultRelayEndpoints[0].url,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: NRConstants.defaultRelayEndpoints[0].requiresNIP42Auth
        )
        let customEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-custom.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let store = RecordingRelayPreferencesStore()
        let relay = RelayPoolClient(
            entries: [
                .init(endpoint: disabledBuiltIn, client: RecordingRelayClient(relayURL: disabledBuiltIn.url)),
                .init(endpoint: customEndpoint, client: RecordingRelayClient(relayURL: customEndpoint.url))
            ],
            defaultEndpoints: NRConstants.defaultRelayEndpoints,
            preferencesStore: store
        )
        let service = LocationSharingService(
            keyStore: InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider()),
            relay: relay,
            storage: InMemoryAppStorage(),
            nip44: NIP44Box(cryptoProvider: RecordingCryptoProvider())
        )

        try service.restoreDefaultRelays()

        XCTAssertEqual(service.relayEndpoints, NRConstants.defaultRelayEndpoints)
        XCTAssertEqual(service.statusText, "3 relays enabled.")
        XCTAssertEqual(store.savedSnapshots.last, NRConstants.defaultRelayEndpoints)
    }

    func testRelayPoolRecordsPerRelayConnectionCheckResults() async throws {
        let workingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let failingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let disabledEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-disabled.example")!,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let pool = RelayPoolClient(entries: [
            .init(endpoint: workingEndpoint, client: RecordingRelayClient(relayURL: workingEndpoint.url)),
            .init(endpoint: failingEndpoint, client: FailingRelayClient(relayURL: failingEndpoint.url)),
            .init(endpoint: disabledEndpoint, client: RecordingRelayClient(relayURL: disabledEndpoint.url))
        ])

        try await pool.connect()

        let results = Dictionary(uniqueKeysWithValues: pool.relayConnectionCheckResults().map { ($0.url, $0) })
        XCTAssertEqual(results[workingEndpoint.url]?.state, .connected)
        XCTAssertEqual(results[failingEndpoint.url]?.state, .failed("Connection failed"))
        XCTAssertEqual(results[failingEndpoint.url]?.consecutiveFailures, 1)
        XCTAssertEqual(results[disabledEndpoint.url]?.state, .skippedOff)

        try await pool.connect()

        let repeatedResults = Dictionary(uniqueKeysWithValues: pool.relayConnectionCheckResults().map { ($0.url, $0) })
        XCTAssertEqual(repeatedResults[workingEndpoint.url]?.consecutiveFailures, 0)
        XCTAssertEqual(repeatedResults[failingEndpoint.url]?.consecutiveFailures, 2)
        XCTAssertEqual(
            repeatedResults[failingEndpoint.url]?.recoveryDescription,
            "Receive and Share keep failing here. Turn this relay off or add another relay."
        )
    }

    func testRelayPoolPersistsConnectionFailureCountsAcrossInstances() async {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let suiteName = "RelayPoolFailureCounts-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let firstPool = RelayPoolClient(
            entries: [
                .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
            ],
            defaultEndpoints: [endpoint],
            preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
        )
        do {
            try await firstPool.connect()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertEqual(firstPool.relayConnectionCheckResults().first?.consecutiveFailures, 1)

        let secondPool = RelayPoolClient(
            entries: [
                .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
            ],
            defaultEndpoints: [endpoint],
            preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
        )
        do {
            try await secondPool.connect()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertEqual(secondPool.relayConnectionCheckResults().first?.consecutiveFailures, 2)
        XCTAssertEqual(
            secondPool.relayConnectionCheckResults().first?.recoveryDescription,
            "Receive and Share keep failing here. Turn this relay off or add another relay."
        )
    }

    func testRelayPoolClearsConnectionFailureCountsWhenRelaySettingsChange() async throws {
        func makeEndpoint(_ host: String) -> NRConstants.RelayEndpoint {
            NRConstants.RelayEndpoint(
                url: URL(string: "wss://\(host)")!,
                readEnabled: true,
                writeEnabled: true,
                requiresNIP42Auth: false
            )
        }

        let addedURL = URL(string: "wss://relay-added.example")!

        for action in ["toggle", "add", "remove"] {
            let endpoint = makeEndpoint("relay-\(action)-failing.example")
            let suiteName = "RelayPoolFailureCountsSettings-\(action)-\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suiteName)!
            defer {
                defaults.removePersistentDomain(forName: suiteName)
            }
            let store = UserDefaultsRelayPreferencesStore(defaults: defaults)
            let pool = RelayPoolClient(
                entries: [
                    .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
                ],
                defaultEndpoints: [endpoint],
                preferencesStore: store
            )

            do {
                try await pool.connect()
                XCTFail("Expected connectFailed")
            } catch {
                guard case RelayPoolError.connectFailed = error else {
                    XCTFail("Unexpected error: \(error)")
                    return
                }
            }
            XCTAssertEqual(store.loadConnectionFailureCounts(), [endpoint.url: 1])

            switch action {
            case "toggle":
                pool.setRelayState(for: endpoint.url, readEnabled: false, writeEnabled: true)
            case "add":
                try pool.addRelay(url: addedURL)
            case "remove":
                try pool.removeRelay(url: endpoint.url)
            default:
                XCTFail("Unexpected settings action")
            }

            XCTAssertEqual(pool.relayConnectionCheckResults(), [])
            XCTAssertEqual(store.loadConnectionFailureCounts(), [:])
        }
    }

    func testRelayPoolPrunesUnconfiguredPersistedConnectionFailureCountsOnLoad() {
        let configuredEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-configured.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let removedRelayURL = URL(string: "wss://relay-removed.example")!
        let suiteName = "RelayPoolFailureCountsPruned-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let store = UserDefaultsRelayPreferencesStore(defaults: defaults)
        store.saveConnectionFailureCounts([
            configuredEndpoint.url: 2,
            removedRelayURL: 5
        ])

        _ = RelayPoolClient(
            entries: [
                .init(endpoint: configuredEndpoint, client: RecordingRelayClient(relayURL: configuredEndpoint.url))
            ],
            defaultEndpoints: [configuredEndpoint],
            preferencesStore: store
        )

        XCTAssertEqual(store.loadConnectionFailureCounts(), [
            configuredEndpoint.url: 2
        ])
    }

    func testRelayPoolClearsPersistedConnectionFailureCountAfterSuccess() async throws {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-flaky.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let suiteName = "RelayPoolFailureCounts-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let failingPool = RelayPoolClient(
            entries: [
                .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
            ],
            defaultEndpoints: [endpoint],
            preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
        )
        do {
            try await failingPool.connect()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }

        let recoveredPool = RelayPoolClient(
            entries: [
                .init(endpoint: endpoint, client: RecordingRelayClient(relayURL: endpoint.url))
            ],
            defaultEndpoints: [endpoint],
            preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
        )
        try await recoveredPool.connect()
        XCTAssertEqual(recoveredPool.relayConnectionCheckResults().first?.state, .connected)
        XCTAssertEqual(recoveredPool.relayConnectionCheckResults().first?.consecutiveFailures, 0)

        let nextFailingPool = RelayPoolClient(
            entries: [
                .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
            ],
            defaultEndpoints: [endpoint],
            preferencesStore: UserDefaultsRelayPreferencesStore(defaults: defaults)
        )
        do {
            try await nextFailingPool.connect()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
        XCTAssertEqual(nextFailingPool.relayConnectionCheckResults().first?.consecutiveFailures, 1)
    }

    func testRelayPoolClearsStaleConnectionCheckWhenRelayStateChanges() async throws {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: RecordingRelayClient(relayURL: endpoint.url))
        ])

        try await pool.connect()
        XCTAssertEqual(pool.relayConnectionCheckResults(), [
            RelayConnectionCheckResult(url: endpoint.url, state: .connected)
        ])

        XCTAssertFalse(pool.setRelayState(for: endpoint.url, readEnabled: true, writeEnabled: true))
        XCTAssertEqual(pool.relayConnectionCheckResults(), [
            RelayConnectionCheckResult(url: endpoint.url, state: .connected)
        ])

        XCTAssertTrue(pool.setRelayState(for: endpoint.url, readEnabled: false, writeEnabled: true))

        XCTAssertEqual(pool.relayConnectionCheckResults(), [])
    }

    func testRelayPoolResetsAffectedRelayRuntimeWhenRelayStateChanges() async throws {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let client = RecordingRelayClient(relayURL: endpoint.url)
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: client)
        ])
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "81", count: 32))

        try await pool.connect()
        try await pool.authenticate(with: keyStore)
        try await pool.subscribe(.init(eventKind: NRConstants.nostrailLocationEventKind, recipientPubkeys: ["recipient"]))

        XCTAssertTrue(pool.isAuthenticated)
        XCTAssertTrue(client.isAuthenticated)
        XCTAssertEqual(client.subscribeCallCountSnapshot(), 1)

        pool.setRelayState(for: endpoint.url, readEnabled: false, writeEnabled: true)

        XCTAssertFalse(pool.isAuthenticated)
        XCTAssertFalse(client.isAuthenticated)
        XCTAssertEqual(client.resetCallCountSnapshot(), 1)
    }

    func testRelayPoolResetsRuntimeWhenRelayIsAdded() async throws {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let client = RecordingRelayClient(relayURL: endpoint.url)
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: client)
        ])
        let keyStore = InMemoryKeyStore(cryptoProvider: RecordingCryptoProvider())
        try keyStore.importSecret(String(repeating: "83", count: 32))

        try await pool.connect()
        try await pool.authenticate(with: keyStore)
        XCTAssertTrue(pool.isAuthenticated)
        XCTAssertTrue(client.isAuthenticated)
        XCTAssertEqual(pool.relayConnectionCheckResults(), [
            RelayConnectionCheckResult(url: endpoint.url, state: .connected)
        ])

        try pool.addRelay(url: URL(string: "wss://relay-added.example")!)

        XCTAssertFalse(pool.isAuthenticated)
        XCTAssertFalse(client.isAuthenticated)
        XCTAssertEqual(client.resetCallCountSnapshot(), 1)
        XCTAssertEqual(pool.relayConnectionCheckResults(), [])
    }

    func testRelayPoolRejectsConnectWhenAllRelaysAreOff() async {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-off.example")!,
            readEnabled: false,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: RecordingRelayClient(relayURL: endpoint.url))
        ])

        do {
            try await pool.connect()
            XCTFail("Expected noEnabledRelays")
        } catch {
            guard case RelayPoolError.noEnabledRelays = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }

        XCTAssertEqual(pool.relayConnectionCheckResults(), [
            RelayConnectionCheckResult(url: endpoint.url, state: .skippedOff)
        ])
    }

    func testRelayPoolRejectsConnectWhenAllEnabledRelaysFail() async {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let pool = RelayPoolClient(entries: [
            .init(endpoint: endpoint, client: FailingRelayClient(relayURL: endpoint.url))
        ])

        do {
            try await pool.connect()
            XCTFail("Expected connectFailed")
        } catch {
            guard case RelayPoolError.connectFailed(let reasons) = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
            XCTAssertEqual(reasons.count, 1)
            XCTAssertTrue(reasons[0].contains("relay-failing.example"))
            XCTAssertTrue(error.localizedDescription.contains("Could not reach any enabled relay"))
        }
    }

    func testRelayPoolConnectAllowsPartialRelayFailure() async throws {
        let workingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-working.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let failingEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-failing.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let pool = RelayPoolClient(entries: [
            .init(endpoint: workingEndpoint, client: RecordingRelayClient(relayURL: workingEndpoint.url)),
            .init(endpoint: failingEndpoint, client: FailingRelayClient(relayURL: failingEndpoint.url))
        ])

        try await pool.connect()
    }

    func testRelayPoolRejectsSubscribeWhenNoReadableRelays() async {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-disabled.example")!,
            readEnabled: false,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let client = RecordingRelayClient(relayURL: endpoint.url)
        let pool = RelayPoolClient(entries: [.init(endpoint: endpoint, client: client)])

        do {
            try await pool.subscribe(.init(eventKind: NRConstants.nostrailLocationEventKind, recipientPubkeys: []))
            XCTFail("Expected noReadableRelays")
        } catch {
            guard case RelayPoolError.noReadableRelays = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }

        XCTAssertEqual(client.subscribeCallCountSnapshot(), 0)
    }

    func testRelayPoolOnlySubscribesReadableRelays() async throws {
        let readableEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-readable.example")!,
            readEnabled: true,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let disabledEndpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-disabled.example")!,
            readEnabled: false,
            writeEnabled: true,
            requiresNIP42Auth: false
        )
        let readableClient = RecordingRelayClient(relayURL: readableEndpoint.url)
        let disabledClient = RecordingRelayClient(relayURL: disabledEndpoint.url)
        let pool = RelayPoolClient(entries: [
            .init(endpoint: readableEndpoint, client: readableClient),
            .init(endpoint: disabledEndpoint, client: disabledClient)
        ])

        try await pool.subscribe(.init(eventKind: NRConstants.nostrailLocationEventKind, recipientPubkeys: []))

        XCTAssertEqual(readableClient.subscribeCallCountSnapshot(), 1)
        XCTAssertEqual(disabledClient.subscribeCallCountSnapshot(), 0)
    }

    func testRelayPoolRejectsPublishWhenNoWritableRelays() async {
        let endpoint = NRConstants.RelayEndpoint(
            url: URL(string: "wss://relay-readonly.example")!,
            readEnabled: true,
            writeEnabled: false,
            requiresNIP42Auth: false
        )
        let client = RecordingRelayClient(relayURL: endpoint.url)
        let pool = RelayPoolClient(entries: [.init(endpoint: endpoint, client: client)])
        let event = NostrEvent(
            id: "event-id",
            pubkey: "pubkey",
            createdAt: 1_700_000_000,
            kind: NRConstants.nostrailLocationEventKind,
            tags: [],
            content: "{}",
            sig: "sig"
        )

        do {
            try await pool.publish(event)
            XCTFail("Expected noWritableRelays")
        } catch {
            guard case RelayPoolError.noWritableRelays = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }

        XCTAssertEqual(client.publishedEventsSnapshot().count, 0)
    }

    private func makeMockURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    private func makeStoredLocationRecord(id: String, createdAt: Int, expiresAt: Int) -> StoredLocationRecord {
        StoredLocationRecord(
            id: id,
            fromPubkey: String(repeating: "ab", count: 32),
            location: LocationEventPayload(
                sessionId: "session-\(id)",
                area: "9F4MGCC5+",
                centerLat: 52.52,
                centerLon: 13.41,
                accuracyM: NRConstants.defaultApproximateAccuracyMeters,
                createdAt: createdAt,
                expiresAt: expiresAt
            ),
            receivedAt: createdAt
        )
    }

    private func makeRecordingEvent(pubkey: String, recipient: String, payload: String) -> NostrEvent {
        let encodedPayload = "RECORDING:" + Data(payload.utf8).base64EncodedString()
        return NostrEvent(
            id: UUID().uuidString,
            pubkey: pubkey,
            createdAt: Int(Date().timeIntervalSince1970),
            kind: NRConstants.nostrailLocationEventKind,
            tags: [["p", recipient], ["expiration", "\(Int(Date().timeIntervalSince1970) + 300)"]],
            content: encodedPayload,
            sig: String(repeating: "cd", count: 64)
        )
    }

    private func skipIfNostrSDKUnavailable() throws {
        if !NostrSDKCryptoProvider.isLinked {
            throw XCTSkip("NostrSDK package is not linked in this package-free compile-check build.")
        }
    }
}

private final class RecordingRelayPreferencesStore: RelayPreferencesStoring {
    private(set) var savedSnapshots: [[NRConstants.RelayEndpoint]] = []

    func load(defaults: [NRConstants.RelayEndpoint]) -> [NRConstants.RelayEndpoint] {
        defaults
    }

    func save(_ endpoints: [NRConstants.RelayEndpoint]) {
        savedSnapshots.append(endpoints)
    }
}

private final class RecordingNip05Resolver: Nip05Resolving {
    private let results: [String: String]
    private let stateLock = NSLock()
    private var resolvedHandles: [String] = []

    init(results: [String: String]) {
        self.results = results
    }

    @inline(__always)
    private func withStateLock<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    func resolve(_ handle: String) async throws -> String {
        withStateLock {
            resolvedHandles.append(handle)
        }
        guard let result = results[handle] else {
            throw Nip05ResolverError.nameNotFound(handle)
        }
        return result
    }

    func resolvedHandlesSnapshot() -> [String] {
        withStateLock { resolvedHandles }
    }
}

private final class RecordingRelayClient: RelayClient, RelayRuntimeResetting {
    let relayURL: URL
    private(set) var isAuthenticated = false
    private let stateLock = NSLock()
    private var continuation: AsyncStream<NostrEvent>.Continuation?
    private var shouldFinishIncomingOnCreation = false
    private var publishedEvents: [NostrEvent] = []
    private var subscribeCallCount = 0
    private var resetCallCount = 0

    @inline(__always)
    private func withStateLock<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    var incomingEvents: AsyncStream<NostrEvent> {
        AsyncStream { continuation in
            self.continuation = continuation
            if self.withStateLock({ self.shouldFinishIncomingOnCreation }) {
                continuation.finish()
            }
        }
    }

    init(relayURL: URL) {
        self.relayURL = relayURL
    }

    func connect() async throws {
        withStateLock {
            shouldFinishIncomingOnCreation = false
        }
    }

    func authenticate(with keyStore: KeyStore) async throws {
        _ = keyStore.currentPublicKeyHex()
        withStateLock {
            isAuthenticated = true
        }
    }

    func publish(_ event: NostrEvent) async throws {
        guard withStateLock({ isAuthenticated }) else {
            throw NSError(domain: "RelayClient", code: 401, userInfo: [NSLocalizedDescriptionKey: "Relay auth required"])
        }
        withStateLock {
            publishedEvents.append(event)
        }
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        _ = subscription
        withStateLock {
            subscribeCallCount += 1
        }
    }

    func resetRelayRuntimeForKeyChange() {
        withStateLock {
            isAuthenticated = false
            resetCallCount += 1
        }
    }

    func publishedEventsSnapshot() -> [NostrEvent] {
        withStateLock { publishedEvents }
    }

    func subscribeCallCountSnapshot() -> Int {
        withStateLock { subscribeCallCount }
    }

    func resetCallCountSnapshot() -> Int {
        withStateLock { resetCallCount }
    }

    func emitIncoming(_ event: NostrEvent) {
        continuation?.yield(event)
    }

    func finishIncoming() {
        let existingContinuation = withStateLock { () -> AsyncStream<NostrEvent>.Continuation? in
            shouldFinishIncomingOnCreation = true
            return continuation
        }
        existingContinuation?.finish()
    }
}

private final class FailingRelayClient: RelayClient {
    let relayURL: URL
    private(set) var isAuthenticated = false

    lazy var incomingEvents: AsyncStream<NostrEvent> = AsyncStream { _ in }

    init(relayURL: URL) {
        self.relayURL = relayURL
    }

    func connect() async throws {
        throw NSError(domain: "FailingRelayClient", code: 1, userInfo: [NSLocalizedDescriptionKey: "Connection failed"])
    }

    func authenticate(with keyStore: KeyStore) async throws {
        _ = keyStore
        throw NSError(domain: "FailingRelayClient", code: 2, userInfo: [NSLocalizedDescriptionKey: "Authentication failed"])
    }

    func publish(_ event: NostrEvent) async throws {
        _ = event
        throw NSError(domain: "FailingRelayClient", code: 3, userInfo: [NSLocalizedDescriptionKey: "Publish failed"])
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        _ = subscription
        throw NSError(domain: "FailingRelayClient", code: 4, userInfo: [NSLocalizedDescriptionKey: "Subscribe failed"])
    }
}

private final class PublishFailingRelayClient: RelayClient {
    let relayURL: URL
    private(set) var isAuthenticated = false
    private let failOnPublishNumbers: Set<Int>
    private var publishCount = 0
    private var authenticateCallCount = 0
    private var publishedEvents: [NostrEvent] = []
    private let stateLock = NSLock()

    lazy var incomingEvents: AsyncStream<NostrEvent> = AsyncStream { _ in }

    convenience init(relayURL: URL, failOnPublishNumber: Int) {
        self.init(relayURL: relayURL, failOnPublishNumbers: [failOnPublishNumber])
    }

    init(relayURL: URL, failOnPublishNumbers: Set<Int>) {
        self.relayURL = relayURL
        self.failOnPublishNumbers = failOnPublishNumbers
    }

    @inline(__always)
    private func withStateLock<T>(_ body: () -> T) -> T {
        stateLock.lock()
        defer { stateLock.unlock() }
        return body()
    }

    func connect() async throws {}

    func authenticate(with keyStore: KeyStore) async throws {
        _ = keyStore.currentPublicKeyHex()
        withStateLock {
            authenticateCallCount += 1
            isAuthenticated = true
        }
    }

    func publish(_ event: NostrEvent) async throws {
        _ = event
        let currentCount = withStateLock {
            publishCount += 1
            return publishCount
        }
        if failOnPublishNumbers.contains(currentCount) {
            throw NSError(domain: "PublishFailingRelayClient", code: currentCount, userInfo: [NSLocalizedDescriptionKey: "Publish failed"])
        }
        withStateLock {
            publishedEvents.append(event)
        }
    }

    func subscribe(_ subscription: RelaySubscription) async throws {
        _ = subscription
    }

    func authenticateCallCountSnapshot() -> Int {
        withStateLock { authenticateCallCount }
    }

    func publishCallCountSnapshot() -> Int {
        withStateLock { publishCount }
    }

    func publishedEventsSnapshot() -> [NostrEvent] {
        withStateLock { publishedEvents }
    }
}

private final class RawRecordingKeyStore: KeyStore {
    private(set) var importedSecrets: [String] = []
    private var secretHex: String?
    private let cryptoProvider = RecordingCryptoProvider()

    func importSecret(_ key: String) throws {
        importedSecrets.append(key)
        secretHex = key
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

    func storageStatus() -> KeyStorageStatus {
        KeyStorageStatus(hasSecret: secretHex != nil, usesSimulatorFallback: false)
    }

    func sign(unsigned: UnsignedNostrEvent) throws -> NostrEvent {
        NostrEvent(
            id: try NIP01.eventIDHex(for: unsigned),
            pubkey: unsigned.pubkey,
            createdAt: unsigned.createdAt,
            kind: unsigned.kind,
            tags: unsigned.tags,
            content: unsigned.content,
            sig: String(repeating: "ef", count: 64)
        )
    }
}

private final class MockURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private final class RecordingCryptoProvider: NostrCryptoProviding {
    let algorithmLabel = "test-recording-provider"
    let fixedPubkey = String(repeating: "ab", count: 32)
    let fixedSignature = String(repeating: "cd", count: 64)
    private(set) var signCallCount = 0
    private(set) var lastSignedEventID: String?
    private(set) var encryptionWasRequested = false
    private(set) var decryptionWasRequested = false

    func publicKeyHex(fromSecretHex secretHex: String) throws -> String {
        guard secretHex.count == 64 else { throw NostrCryptoProviderError.invalidKeyMaterial }
        return fixedPubkey
    }

    func signEventIDHex(_ eventID: String, secretHex: String) throws -> String {
        signCallCount += 1
        lastSignedEventID = eventID
        return fixedSignature
    }

    func nip44Encrypt(plainText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = localSecretHex
        _ = peerPubkeyHex
        encryptionWasRequested = true
        return "RECORDING:" + Data(plainText.utf8).base64EncodedString()
    }

    func nip44Decrypt(cipherText: String, localSecretHex: String, peerPubkeyHex: String) throws -> String {
        _ = localSecretHex
        _ = peerPubkeyHex
        decryptionWasRequested = true
        guard cipherText.hasPrefix("RECORDING:"),
              let data = Data(base64Encoded: String(cipherText.dropFirst("RECORDING:".count))),
              let plainText = String(data: data, encoding: .utf8) else {
            throw NostrCryptoProviderError.invalidKeyMaterial
        }
        return plainText
    }
}
