import Foundation

enum PlusCode {
    static let normalCodeLength = 10
    static let neighborhoodCodeLength = 8

    private static let alphabet = Array("23456789CFGHJMPQRVWX")
    private static let separator = "+"
    private static let separatorPosition = 8
    private static let maxCodeLength = 15
    private static let encodingBase = alphabet.count
    private static let latitudeMax = 90.0
    private static let longitudeMax = 180.0
    private static let pairCodeLength = 10
    private static let gridRows = 5
    private static let gridColumns = 4
    private static let pairPrecision = Int(pow(Double(encodingBase), 3.0))
    private static let finalLatitudePrecision = pairPrecision * Int(pow(Double(gridRows), Double(maxCodeLength - pairCodeLength)))
    private static let finalLongitudePrecision = pairPrecision * Int(pow(Double(gridColumns), Double(maxCodeLength - pairCodeLength)))

    static func encode(latitude: Double, longitude: Double, codeLength: Int = normalCodeLength) -> String {
        guard codeLength >= 2 else { return "" }
        if codeLength < pairCodeLength, codeLength.isMultiple(of: 2) == false {
            return ""
        }

        let boundedCodeLength = min(maxCodeLength, codeLength)
        var editedLatitude = clipLatitude(latitude)
        let editedLongitude = normalizeLongitude(longitude)

        if editedLatitude == latitudeMax {
            editedLatitude -= computeLatitudePrecision(codeLength: boundedCodeLength)
        }

        var code = ""

        var latValue = Int(floor(((editedLatitude + latitudeMax) * Double(finalLatitudePrecision)).rounded()))
        var lonValue = Int(floor(((editedLongitude + longitudeMax) * Double(finalLongitudePrecision)).rounded()))

        if boundedCodeLength > pairCodeLength {
            for _ in 0..<(maxCodeLength - pairCodeLength) {
                let latDigit = latValue % gridRows
                let lonDigit = lonValue % gridColumns
                let index = latDigit * gridColumns + lonDigit
                code = String(alphabet[index]) + code
                latValue /= gridRows
                lonValue /= gridColumns
            }
        } else {
            latValue /= Int(pow(Double(gridRows), Double(maxCodeLength - pairCodeLength)))
            lonValue /= Int(pow(Double(gridColumns), Double(maxCodeLength - pairCodeLength)))
        }

        for _ in 0..<(pairCodeLength / 2) {
            code = String(alphabet[lonValue % encodingBase]) + code
            code = String(alphabet[latValue % encodingBase]) + code
            latValue /= encodingBase
            lonValue /= encodingBase
        }

        code = String(code.prefix(separatorPosition)) + separator + String(code.dropFirst(separatorPosition))

        if boundedCodeLength >= separatorPosition {
            return String(code.prefix(boundedCodeLength + 1))
        }

        let prefix = String(code.prefix(boundedCodeLength))
        let padding = String(repeating: "0", count: separatorPosition - boundedCodeLength)
        return prefix + padding + separator
    }

    private static func clipLatitude(_ latitude: Double) -> Double {
        min(latitudeMax, max(-latitudeMax, latitude))
    }

    private static func normalizeLongitude(_ longitude: Double) -> Double {
        var normalized = longitude
        while normalized < -longitudeMax {
            normalized += 360
        }
        while normalized >= longitudeMax {
            normalized -= 360
        }
        return normalized
    }

    private static func computeLatitudePrecision(codeLength: Int) -> Double {
        if codeLength <= pairCodeLength {
            return pow(20, floor(Double(codeLength) / -2 + 2))
        }
        return pow(20, -3) / pow(Double(gridRows), Double(codeLength - pairCodeLength))
    }
}
