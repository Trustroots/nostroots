import Foundation

struct SnappedLocation: Equatable {
    let latitude: Double
    let longitude: Double
    let accuracyMeters: Double
    let areaCode: String
}

enum LocationSnapper {
    static func snap(latitude: Double, longitude: Double, accuracyMeters: Double = NRConstants.defaultApproximateAccuracyMeters) -> SnappedLocation {
        let coarseLat = round(latitude * 200) / 200 // ~550m
        let coarseLon = round(longitude * 200) / 200
        let area = PlusCode.encode(latitude: coarseLat, longitude: coarseLon, codeLength: PlusCode.neighborhoodCodeLength)
        return SnappedLocation(latitude: coarseLat, longitude: coarseLon, accuracyMeters: accuracyMeters, areaCode: area)
    }
}
