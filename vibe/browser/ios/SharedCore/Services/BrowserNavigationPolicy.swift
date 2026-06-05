import Foundation

enum BrowserNavigationDecision: Equatable {
    case allow
    case openExternally
    case cancel
}

struct BrowserNavigationPolicy {
    let allowedOrigin: String

    init(allowedOrigin: String = NRConstants.nostrootsOrigin) {
        self.allowedOrigin = allowedOrigin
    }

    func decision(for url: URL?, developerMode: Bool) -> BrowserNavigationDecision {
        guard let url else { return .cancel }
        guard url.scheme == "http" || url.scheme == "https" else { return .openExternally }
        if developerMode { return .allow }
        return origin(for: url) == allowedOrigin ? .allow : .openExternally
    }

    private func origin(for url: URL) -> String? {
        guard let scheme = url.scheme, let host = url.host else { return nil }
        let port = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(port)"
    }
}
