import Foundation

enum Hex {
    static func decode(_ hex: String) -> Data? {
        let normalized = hex.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalized.count.isMultiple(of: 2), !normalized.isEmpty else { return nil }
        var bytes = Data(capacity: normalized.count / 2)
        var index = normalized.startIndex
        while index < normalized.endIndex {
            let next = normalized.index(index, offsetBy: 2)
            let byteString = normalized[index..<next]
            guard let value = UInt8(byteString, radix: 16) else { return nil }
            bytes.append(value)
            index = next
        }
        return bytes
    }

    static func encode(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
}

