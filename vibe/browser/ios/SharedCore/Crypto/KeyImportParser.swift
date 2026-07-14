import CryptoKit
import Foundation

enum KeyImportError: Error, LocalizedError, Equatable {
    case empty
    case publicKey
    case invalidNsec
    case invalidHex
    case invalidMnemonic
    case invalid

    var errorDescription: String? {
        switch self {
        case .empty:
            return "Enter an nsec, recovery phrase, or private-key hex."
        case .publicKey:
            return "You pasted an npub. That is your public address and is safe to share. Import your nsec private key or recovery phrase instead."
        case .invalidNsec:
            return "That nsec does not look valid. Check for missing or extra characters."
        case .invalidHex:
            return "That private-key hex contains invalid characters. Use 0-9 and a-f only."
        case .invalidMnemonic:
            return "That recovery phrase is not valid. Check the words and their order."
        case .invalid:
            return "Invalid key. Paste an nsec, a 12/24-word recovery phrase, or 64-character private-key hex."
        }
    }
}

enum KeyImportSource: Equatable {
    case nsec
    case hex
    case mnemonic
}

struct KeyImportResult: Equatable {
    let secretHex: String
    let source: KeyImportSource
}

enum KeyImportParser {
    static func parse(_ raw: String) throws -> KeyImportResult {
        let input = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty else { throw KeyImportError.empty }

        let lower = input.lowercased()
        if lower.hasPrefix("npub1") {
            throw KeyImportError.publicKey
        }

        if lower.hasPrefix("nsec1") {
            do {
                return KeyImportResult(secretHex: try NIP19.importSecret(lower), source: .nsec)
            } catch {
                throw KeyImportError.invalidNsec
            }
        }

        if lower.count == 64 {
            guard NIP19.isValidHex(lower, expectedBytes: 32) else {
                throw KeyImportError.invalidHex
            }
            return KeyImportResult(secretHex: lower, source: .hex)
        }

        if lower.contains(" ") || lower.contains("\n") || lower.contains("\t") {
            do {
                return KeyImportResult(secretHex: try MnemonicKeyDeriver.secretHex(from: input), source: .mnemonic)
            } catch {
                throw KeyImportError.invalidMnemonic
            }
        }

        throw KeyImportError.invalid
    }

    static func userFacingMessage(for raw: String, error: Error) -> String {
        if let importError = error as? KeyImportError {
            return importError.localizedDescription
        }
        if let keychainError = error as? KeychainKeyStoreError {
            return keychainError.localizedDescription
        }
        _ = raw
        return error.localizedDescription
    }
}

enum MnemonicKeyDeriver {
    static func secretHex(from phrase: String) throws -> String {
        let normalized = normalize(phrase)
        let words = normalized.split(separator: " ").map(String.init)
        guard [12, 15, 18, 21, 24].contains(words.count),
              validate(words: words) else {
            throw KeyImportError.invalidMnemonic
        }
        let seed = pbkdf2SHA512(
            password: Data(normalized.utf8),
            salt: Data("mnemonic".utf8),
            iterations: 2_048,
            outputByteCount: 64
        )
        return Hex.encode(Data(seed.prefix(32)))
    }

    static func validate(_ phrase: String) -> Bool {
        validate(words: normalize(phrase).split(separator: " ").map(String.init))
    }

    private static func normalize(_ phrase: String) -> String {
        phrase
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .decomposedStringWithCompatibilityMapping
    }

    private static func validate(words: [String]) -> Bool {
        guard [12, 15, 18, 21, 24].contains(words.count) else { return false }
        var bits: [Bool] = []
        bits.reserveCapacity(words.count * 11)

        for word in words {
            guard let index = BIP39EnglishWordList.indexByWord[word] else { return false }
            for bitIndex in stride(from: 10, through: 0, by: -1) {
                bits.append(((index >> bitIndex) & 1) == 1)
            }
        }

        let entropyBitCount = words.count * 11 * 32 / 33
        let checksumBitCount = entropyBitCount / 32
        let entropyBits = Array(bits.prefix(entropyBitCount))
        let checksumBits = Array(bits.dropFirst(entropyBitCount).prefix(checksumBitCount))
        let entropy = bytes(from: entropyBits)
        let hash = Data(SHA256.hash(data: entropy))

        for bitIndex in 0..<checksumBitCount {
            let byte = hash[bitIndex / 8]
            let expected = ((byte >> UInt8(7 - (bitIndex % 8))) & 1) == 1
            guard checksumBits[bitIndex] == expected else { return false }
        }
        return true
    }

    private static func bytes(from bits: [Bool]) -> Data {
        var data = Data(count: bits.count / 8)
        for (index, bit) in bits.enumerated() where bit {
            data[index / 8] |= UInt8(1 << (7 - (index % 8)))
        }
        return data
    }

    private static func pbkdf2SHA512(password: Data, salt: Data, iterations: Int, outputByteCount: Int) -> Data {
        let hashByteCount = 64
        let blockCount = Int(ceil(Double(outputByteCount) / Double(hashByteCount)))
        var output = Data()
        output.reserveCapacity(blockCount * hashByteCount)

        for blockIndex in 1...blockCount {
            var blockSalt = salt
            blockSalt.append(UInt8((blockIndex >> 24) & 0xff))
            blockSalt.append(UInt8((blockIndex >> 16) & 0xff))
            blockSalt.append(UInt8((blockIndex >> 8) & 0xff))
            blockSalt.append(UInt8(blockIndex & 0xff))

            var u = hmacSHA512(key: password, data: blockSalt)
            var t = u
            for _ in 1..<iterations {
                u = hmacSHA512(key: password, data: u)
                for byteIndex in 0..<hashByteCount {
                    t[byteIndex] ^= u[byteIndex]
                }
            }
            output.append(t)
        }

        return Data(output.prefix(outputByteCount))
    }

    private static func hmacSHA512(key: Data, data: Data) -> Data {
        let code = HMAC<SHA512>.authenticationCode(for: data, using: SymmetricKey(data: key))
        return Data(code)
    }
}
