import Foundation

protocol VibePushStateStoring: AnyObject {
    func load() -> VibePushStoredState
    func save(_ state: VibePushStoredState)
}

final class VibePushStateStore: VibePushStateStoring {
    private let defaults: UserDefaults
    private let key: String
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(
        defaults: UserDefaults = .standard,
        key: String = "nostroots.browser.vibePush.state"
    ) {
        self.defaults = defaults
        self.key = key
    }

    func load() -> VibePushStoredState {
        guard let data = defaults.data(forKey: key) else {
            return .empty
        }
        return (try? decoder.decode(VibePushStoredState.self, from: data)) ?? .empty
    }

    func save(_ state: VibePushStoredState) {
        guard let data = try? encoder.encode(state) else { return }
        defaults.set(data, forKey: key)
    }
}

final class InMemoryVibePushStateStore: VibePushStateStoring {
    private var state = VibePushStoredState.empty

    func load() -> VibePushStoredState {
        state
    }

    func save(_ state: VibePushStoredState) {
        self.state = state
    }
}
