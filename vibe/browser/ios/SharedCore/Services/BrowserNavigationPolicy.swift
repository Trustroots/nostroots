import Foundation

enum BrowserNavigationDecision: Equatable {
    case allow
    case openExternally
    case cancel
}

struct BrowserNavigationPolicy {
    func decision(for url: URL?) -> BrowserNavigationDecision {
        guard let url else { return .cancel }
        guard url.scheme == "http" || url.scheme == "https" else { return .openExternally }
        return .allow
    }
}
