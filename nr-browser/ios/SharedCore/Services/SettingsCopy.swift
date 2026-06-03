import Foundation

enum SettingsCopy {
    static let noMnemonicStored = "No recovery phrase is stored. This usually means you imported this key as an nsec instead of a recovery phrase."

    static let removeStoredKeyTitle = "Remove stored key"

    static let removeStoredKeyBody = "This removes the nsec and recovery phrase from Nostroots Browser only. If you do not have a saved copy of the nsec or recovery phrase somewhere else, you will lose access to this Nostr identity."

    static let removeStoredKeyConfirmation = "Remove this key from Nostroots Browser? If you do not have a saved copy of the nsec or recovery phrase somewhere else, you will lose access to this Nostr identity."
}
