import SwiftUI
import UIKit

struct SettingsView: View {
    @ObservedObject var model: BrowserAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingNsec = false
    @State private var confirmingRemoval = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Nostroots Browser")
                        .font(.title2.bold())
                        .foregroundStyle(.primary)

                    VStack(alignment: .leading, spacing: 14) {
                        KeyValueCard(title: "npub", value: model.npub ?? "No public key available.", canCopy: model.npub != nil)

                        KeyValueCard(
                            title: "nsec",
                            value: showingNsec ? (model.nsec ?? "No private key available.") : "••••••••••••••••",
                            canCopy: model.nsec != nil,
                            accessory: {
                                Button {
                                    showingNsec.toggle()
                                } label: {
                                    Image(systemName: showingNsec ? "eye.slash" : "eye")
                                }
                                .accessibilityLabel(showingNsec ? "Hide nsec" : "Show nsec")
                            }
                        )

                        KeyValueCard(
                            title: "mnemonic",
                            value: model.mnemonic ?? SettingsCopy.noMnemonicStored,
                            canCopy: model.mnemonic != nil
                        )
                    }

                    NIP07PermissionsSection(model: model)

                    RemoveKeySection(confirmingRemoval: $confirmingRemoval)

                    VStack(alignment: .leading, spacing: 16) {
                        Toggle(isOn: $model.developerMode) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Developer mode")
                                    .font(.headline)
                                Text("Shows an address bar and allows loading other websites.")
                                    .font(.body)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        HStack {
                            Text("Build time")
                                .font(.headline)
                            Spacer()
                            Text(BuildInfo.buildTime)
                                .font(.body.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(18)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.35)))
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Settings")
            .toolbarBackground(Color(.systemGroupedBackground), for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.title2.weight(.semibold))
                    }
                    .accessibilityLabel("Close settings")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .alert(SettingsCopy.removeStoredKeyTitle, isPresented: $confirmingRemoval) {
            Button("Cancel", role: .cancel) {}
            Button("Remove stored key", role: .destructive) {
                model.removeKey()
                dismiss()
            }
        } message: {
            Text(SettingsCopy.removeStoredKeyConfirmation)
        }
    }
}

private struct NIP07PermissionsSection: View {
    @ObservedObject var model: BrowserAppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("NIP-07 access")
                    .font(.headline)
                Text("Websites that have used or can use your Nostroots Browser key.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if model.nip07PermissionEntries.isEmpty {
                Text("No websites have used NIP-07 yet.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(model.nip07PermissionEntries) { entry in
                        NIP07PermissionRow(entry: entry) {
                            model.revokeNIP07Permission(origin: entry.origin)
                        }
                        if entry.id != model.nip07PermissionEntries.last?.id {
                            Divider()
                                .padding(.leading, 44)
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.35)))
    }
}

private struct NIP07PermissionRow: View {
    let entry: NIP07PermissionEntry
    let revoke: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.canRevoke ? "checkmark.shield" : "checkmark.seal")
                .font(.title3)
                .foregroundStyle(entry.canRevoke ? Color(red: 0.05, green: 0.68, blue: 0.55) : .secondary)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.displayName)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(entry.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let originURL = URL(string: entry.origin) {
                    Link(destination: originURL) {
                        Text(entry.origin)
                            .font(.caption.monospaced())
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    .foregroundStyle(.tint)
                    .accessibilityLabel("Open \(entry.origin)")
                } else {
                    Text(entry.origin)
                        .font(.caption.monospaced())
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }

            Spacer(minLength: 8)

            if entry.canRevoke {
                Button(role: .destructive) {
                    revoke()
                } label: {
                    Image(systemName: "trash")
                        .font(.body.weight(.semibold))
                }
                .accessibilityLabel("Remove NIP-07 access for \(entry.displayName)")
            }
        }
        .padding(.vertical, 12)
    }
}

private struct KeyValueCard<Accessory: View>: View {
    let title: String
    let value: String
    let canCopy: Bool
    let accessory: Accessory

    init(
        title: String,
        value: String,
        canCopy: Bool,
        @ViewBuilder accessory: () -> Accessory = { EmptyView() }
    ) {
        self.title = title
        self.value = value
        self.canCopy = canCopy
        self.accessory = accessory()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.secondary)
                Spacer()
                accessory
                Button {
                    UIPasteboard.general.string = value
                } label: {
                    Image(systemName: "doc.on.doc")
                }
                .disabled(!canCopy)
                .accessibilityLabel("Copy \(title)")
            }
            Text(value)
                .font(.body.monospaced())
                .textSelection(.enabled)
                .foregroundStyle(canCopy ? .primary : .secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.35)))
    }
}

private struct RemoveKeySection: View {
    @Binding var confirmingRemoval: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(SettingsCopy.removeStoredKeyTitle)
                .font(.headline)
                .foregroundStyle(Color(.systemRed))
            Text(SettingsCopy.removeStoredKeyBody)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button(role: .destructive) {
                confirmingRemoval = true
            } label: {
                Text("Remove stored key")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemRed).opacity(0.35)))
    }
}
