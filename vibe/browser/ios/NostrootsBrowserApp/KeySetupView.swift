import SwiftUI

struct KeySetupView: View {
    @ObservedObject var model: BrowserAppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Nostroots iOS")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.primary)

                    OnboardingInfoCard()
                }

                VStack(alignment: .leading, spacing: 14) {
                    Text("Import an existing private key or generate a new one below.")
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    TextEditor(text: $model.keyImportText)
                        .font(.body.monospaced())
                        .foregroundStyle(.primary)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 150)
                        .padding(8)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(.separator).opacity(0.45))
                        )
                        .accessibilityLabel("nsec or recovery phrase")

                    if let error = model.errorMessage {
                        Text(error)
                            .font(.callout)
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Button {
                        model.importKey()
                    } label: {
                        Text("Import key")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.keyImportText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button {
                        model.generateKey()
                    } label: {
                        Text("Generate new key")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(.horizontal, 28)
            .padding(.top, 34)
            .padding(.bottom, 36)
        }
        .background(Color(.systemBackground))
    }
}

private struct OnboardingInfoCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            OnboardingInfoRow(
                systemImage: "network",
                text: "Nostroots rebuilds Trustroots on open protocols, so travelers and hosts keep control of their identity and connections."
            )
            OnboardingInfoRow(
                systemImage: "key",
                text: "This browser helps manage your key. Trustroots cannot access it; it stays on your phone in Apple Keychain."
            )
            OnboardingInfoRow(
                systemImage: "person.crop.circle.badge.checkmark",
                text: "Connect a key to start. To fully use Nostroots, link a Trustroots account to this key. New to Trustroots? [Sign up first.](https://www.trustroots.org/signup)"
            )
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.separator).opacity(0.35)))
    }
}

private struct OnboardingInfoRow: View {
    let systemImage: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color(red: 0.05, green: 0.68, blue: 0.55))
                .frame(width: 24, height: 24)

            Text(text)
                .font(.body)
                .foregroundStyle(.secondary)
                .tint(Color(red: 0.05, green: 0.68, blue: 0.55))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
