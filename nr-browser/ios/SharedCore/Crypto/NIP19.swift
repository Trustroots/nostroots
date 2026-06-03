import Foundation
import Security

enum NIP19Error: Error, LocalizedError {
    case invalidFormat
    case unsupportedPrefix
    case invalidHex
    case invalidData
    case invalidChecksum

    var errorDescription: String? {
        switch self {
        case .invalidFormat: return "Invalid key format."
        case .unsupportedPrefix: return "Only nsec keys are supported for bech32 input."
        case .invalidHex: return "Invalid hex private key."
        case .invalidData: return "Unable to decode bech32 data."
        case .invalidChecksum: return "Invalid bech32 checksum."
        }
    }
}

enum NIP19 {
    private static let charset = Array("qpzry9x8gf2tvdw0s3jn54khce6mua7l")

    static func importSecret(_ input: String) throws -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if isValidHex(trimmed, expectedBytes: 32) {
            return trimmed
        }
        if trimmed.hasPrefix("nsec1") {
            return try decodeNsec(trimmed)
        }
        throw NIP19Error.invalidFormat
    }

    static func importPubkey(_ input: String) throws -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if isValidHex(trimmed, expectedBytes: 32) {
            return trimmed
        }
        if trimmed.hasPrefix("npub1") {
            return try decodeBech32Hex(trimmed, expectedHRP: "npub")
        }
        throw NIP19Error.invalidFormat
    }

    static func generateSecretHex() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { throw NIP19Error.invalidData }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func encodeNsec(secretHex: String) throws -> String {
        try encodeBech32Hex(secretHex, hrp: "nsec")
    }

    static func encodeNpub(pubkeyHex: String) throws -> String {
        try encodeBech32Hex(pubkeyHex, hrp: "npub")
    }

    private static func encodeBech32Hex(_ hex: String, hrp: String) throws -> String {
        let normalized = hex.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard isValidHex(normalized, expectedBytes: 32),
              let bytes = Hex.decode(normalized) else {
            throw NIP19Error.invalidHex
        }
        let data = convertBits(data: Array(bytes), fromBits: 8, toBits: 5, pad: true)
        let checksum = createChecksum(hrp: hrp, data: data)
        let encoded = (data + checksum).map { String(charset[Int($0)]) }.joined()
        return "\(hrp)1\(encoded)"
    }

    static func isValidHex(_ value: String, expectedBytes: Int) -> Bool {
        let hex = value.lowercased()
        guard hex.count == expectedBytes * 2 else { return false }
        return hex.range(of: "^[0-9a-f]+$", options: .regularExpression) != nil
    }

    private static func decodeNsec(_ value: String) throws -> String {
        try decodeBech32Hex(value, expectedHRP: "nsec")
    }

    private static func decodeBech32Hex(_ value: String, expectedHRP: String) throws -> String {
        guard let separator = value.lastIndex(of: "1") else {
            throw NIP19Error.invalidFormat
        }
        let hrp = String(value[..<separator])
        guard hrp == expectedHRP else {
            throw NIP19Error.unsupportedPrefix
        }
        let dataPart = String(value[value.index(after: separator)...])
        let values = try decodeDataPart(dataPart)
        guard values.count > 6 else { throw NIP19Error.invalidData }
        guard verifyChecksum(hrp: hrp, data: values) else { throw NIP19Error.invalidChecksum }
        let payload5Bits = Array(values.dropLast(6))
        let bytes = convertBits(data: payload5Bits, fromBits: 5, toBits: 8, pad: false)
        guard bytes.count == 32 else { throw NIP19Error.invalidData }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private static func decodeDataPart(_ dataPart: String) throws -> [UInt8] {
        var map: [Character: UInt8] = [:]
        for (index, char) in charset.enumerated() {
            map[char] = UInt8(index)
        }
        var values: [UInt8] = []
        for char in dataPart {
            guard let value = map[char] else { throw NIP19Error.invalidData }
            values.append(value)
        }
        return values
    }

    private static func convertBits(data: [UInt8], fromBits: Int, toBits: Int, pad: Bool) -> [UInt8] {
        var acc = 0
        var bits = 0
        let maxv = (1 << toBits) - 1
        var result: [UInt8] = []

        for value in data {
            acc = (acc << fromBits) | Int(value)
            bits += fromBits
            while bits >= toBits {
                bits -= toBits
                result.append(UInt8((acc >> bits) & maxv))
            }
        }
        if pad && bits > 0 {
            result.append(UInt8((acc << (toBits - bits)) & maxv))
        }
        return result
    }

    private static func hrpExpand(_ hrp: String) -> [UInt8] {
        var values: [UInt8] = []
        for scalar in hrp.unicodeScalars {
            values.append(UInt8(scalar.value >> 5))
        }
        values.append(0)
        for scalar in hrp.unicodeScalars {
            values.append(UInt8(scalar.value & 31))
        }
        return values
    }

    private static func polymod(_ values: [UInt8]) -> UInt32 {
        let generators: [UInt32] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
        var chk: UInt32 = 1
        for value in values {
            let top = chk >> 25
            chk = ((chk & 0x1ffffff) << 5) ^ UInt32(value)
            for i in 0..<5 where ((top >> i) & 1) == 1 {
                chk ^= generators[i]
            }
        }
        return chk
    }

    private static func verifyChecksum(hrp: String, data: [UInt8]) -> Bool {
        polymod(hrpExpand(hrp) + data) == 1
    }

    private static func createChecksum(hrp: String, data: [UInt8]) -> [UInt8] {
        let values = hrpExpand(hrp) + data
        let polymodValue = polymod(values + Array(repeating: 0, count: 6)) ^ 1
        return (0..<6).map { index in
            UInt8((polymodValue >> (5 * (5 - index))) & 31)
        }
    }
}
