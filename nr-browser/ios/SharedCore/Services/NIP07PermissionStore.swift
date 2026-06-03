import Foundation

struct NIP07PermissionEntry: Identifiable, Equatable {
    enum Kind: Equatable {
        case trusted
        case remembered
    }

    let origin: String
    let displayName: String
    let detail: String
    let kind: Kind

    var id: String {
        "\(origin)-\(kind)"
    }

    var canRevoke: Bool {
        kind == .remembered
    }
}

struct NIP07PermissionPolicy {
    private let trustedDomains = ["trustroots.org", "hitchwiki.org"]

    func origin(for url: URL?) -> String? {
        guard let url, let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else {
            return nil
        }
        guard scheme == "http" || scheme == "https" else { return nil }
        let port = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(port)"
    }

    func host(for origin: String) -> String {
        URL(string: origin)?.host ?? origin
    }

    func isAutoAllowed(origin: String) -> Bool {
        guard let host = URL(string: origin)?.host?.lowercased() else { return false }
        return trustedDomains.contains { domain in
            host == domain || host.hasSuffix(".\(domain)")
        }
    }

    func trustedDomainLabel(for origin: String) -> String? {
        guard let host = URL(string: origin)?.host?.lowercased() else { return nil }
        guard let domain = trustedDomains.first(where: { host == $0 || host.hasSuffix(".\($0)") }) else {
            return nil
        }
        return host == domain ? domain : "*.\(domain)"
    }
}

protocol NIP07PermissionStoring: AnyObject {
    func isAllowed(origin: String) -> Bool
    func allow(origin: String)
    func revoke(origin: String)
    func recordTrustedUse(origin: String)
    func entries(policy: NIP07PermissionPolicy) -> [NIP07PermissionEntry]
    func clear()
}

final class NIP07PermissionStore: NIP07PermissionStoring {
    private let defaults: UserDefaults
    private let allowedKey: String
    private let trustedUseKey: String

    init(
        defaults: UserDefaults = .standard,
        allowedKey: String = "nostroots.browser.nip7.allowedOrigins",
        trustedUseKey: String = "nostroots.browser.nip7.usedTrustedOrigins"
    ) {
        self.defaults = defaults
        self.allowedKey = allowedKey
        self.trustedUseKey = trustedUseKey
    }

    func isAllowed(origin: String) -> Bool {
        allowedOrigins.contains(origin)
    }

    func allow(origin: String) {
        var origins = allowedOrigins
        origins.insert(origin)
        defaults.set(Array(origins).sorted(), forKey: allowedKey)
    }

    func revoke(origin: String) {
        var origins = allowedOrigins
        origins.remove(origin)
        defaults.set(Array(origins).sorted(), forKey: allowedKey)
    }

    func recordTrustedUse(origin: String) {
        var origins = usedTrustedOrigins
        origins.insert(origin)
        defaults.set(Array(origins).sorted(), forKey: trustedUseKey)
    }

    func entries(policy: NIP07PermissionPolicy) -> [NIP07PermissionEntry] {
        permissionEntries(
            allowedOrigins: allowedOrigins,
            usedTrustedOrigins: usedTrustedOrigins,
            policy: policy
        )
    }

    func clear() {
        defaults.removeObject(forKey: allowedKey)
        defaults.removeObject(forKey: trustedUseKey)
    }

    private var allowedOrigins: Set<String> {
        Set(defaults.stringArray(forKey: allowedKey) ?? [])
    }

    private var usedTrustedOrigins: Set<String> {
        Set(defaults.stringArray(forKey: trustedUseKey) ?? [])
    }
}

final class InMemoryNIP07PermissionStore: NIP07PermissionStoring {
    private var origins: Set<String> = []
    private var trustedOrigins: Set<String> = []

    func isAllowed(origin: String) -> Bool {
        origins.contains(origin)
    }

    func allow(origin: String) {
        origins.insert(origin)
    }

    func revoke(origin: String) {
        origins.remove(origin)
    }

    func recordTrustedUse(origin: String) {
        trustedOrigins.insert(origin)
    }

    func entries(policy: NIP07PermissionPolicy) -> [NIP07PermissionEntry] {
        permissionEntries(
            allowedOrigins: origins,
            usedTrustedOrigins: trustedOrigins,
            policy: policy
        )
    }

    func clear() {
        origins.removeAll()
        trustedOrigins.removeAll()
    }
}

private func permissionEntries(
    allowedOrigins: Set<String>,
    usedTrustedOrigins: Set<String>,
    policy: NIP07PermissionPolicy
) -> [NIP07PermissionEntry] {
    let trustedEntries = usedTrustedOrigins
        .filter { policy.isAutoAllowed(origin: $0) }
        .map { origin in
            let trustedLabel = policy.trustedDomainLabel(for: origin)
            let detail = trustedLabel.map { "Trusted \($0) site" } ?? "Trusted website"
            return NIP07PermissionEntry(
                origin: origin,
                displayName: policy.host(for: origin),
                detail: detail,
                kind: .trusted
            )
        }

    let rememberedEntries = allowedOrigins.map { origin in
        NIP07PermissionEntry(
            origin: origin,
            displayName: policy.host(for: origin),
            detail: "Always allowed",
            kind: .remembered
        )
    }

    return (trustedEntries + rememberedEntries).sorted {
        if $0.displayName == $1.displayName {
            return $0.origin < $1.origin
        }
        return $0.displayName < $1.displayName
    }
}
