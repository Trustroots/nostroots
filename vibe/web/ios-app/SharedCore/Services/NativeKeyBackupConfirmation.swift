import Foundation

enum NativeKeyBackupConfirmation {
    static func matches(confirmation: String, generatedNsec: String) -> Bool {
        !generatedNsec.isEmpty &&
            confirmation.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == generatedNsec.lowercased()
    }
}
