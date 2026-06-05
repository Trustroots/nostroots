import Foundation

enum BuildInfo {
    static var buildTime: String {
        Bundle.main.object(forInfoDictionaryKey: "NRBuildTime") as? String ?? "Unknown"
    }

    static func formattedBuildTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.string(from: date)
    }
}
