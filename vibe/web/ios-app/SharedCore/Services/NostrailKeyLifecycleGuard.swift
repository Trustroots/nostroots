import Foundation

enum NostrailKeyLifecycleGuard {
    static let pendingShareStartCancelMessage = "Pending sharing start canceled before clearing the key."
    static let clearKeyConfirmation = "You will return to setup. Make sure your nsec or recovery phrase is backed up before clearing it."

    static func blockedClearKeyMessage(isSharing: Bool, isStopping: Bool) -> String? {
        if isStopping {
            return "Finish stopping sharing before clearing the key."
        }
        if isSharing {
            return "Stop sharing before clearing the key so Nostrail can tell recipients the session ended."
        }
        return nil
    }
}
