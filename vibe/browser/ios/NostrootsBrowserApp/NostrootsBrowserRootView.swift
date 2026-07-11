import SwiftUI

struct NostrootsBrowserRootView: View {
    @ObservedObject var model: BrowserAppModel
    @State private var showingSettings = false

    var body: some View {
        Group {
            if model.hasKey {
                BrowserView(model: model, showingSettings: $showingSettings)
            } else {
                KeySetupView(model: model)
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView(model: model) { url in
                model.loadURL(url)
                showingSettings = false
            }
                .presentationDragIndicator(.visible)
        }
    }
}

private struct BrowserView: View {
    @ObservedObject var model: BrowserAppModel
    @Binding var showingSettings: Bool
    @State private var addressBarHidden = false
    @State private var addressBarAutoHideTask: Task<Void, Never>?
    @FocusState private var addressBarFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            BrowserHeader(
                showingSettings: $showingSettings,
                goHome: {
                    model.resetToNostroots()
                }
            )
            ZStack(alignment: .bottom) {
                NativeBrowserWebView(
                    url: URL(string: model.currentURLString) ?? NRConstants.nostrootsURL,
                    reloadID: model.webViewReloadID,
                    keyStore: model.keyStore,
                    cryptoProvider: model.cryptoProvider,
                    permissionStore: model.nip07PermissionStore,
                    pushNotifications: model.pushNotifications,
                    requestNIP07Permission: { prompt in
                        model.requestNIP07Permission(prompt)
                    },
                    currentURLString: $model.currentURLString,
                    addressBarHidden: $addressBarHidden,
                    pendingNotificationPlusCode: $model.pendingNotificationPlusCode
                )
                .ignoresSafeArea(edges: .bottom)

                AddressBar(model: model, isFocused: $addressBarFocused)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 10)
                    .offset(y: addressBarHidden ? 112 : 0)
                    .opacity(addressBarHidden ? 0 : 1)
                    .allowsHitTesting(!addressBarHidden)
                    .animation(.easeInOut(duration: 0.24), value: addressBarHidden)
            }
        }
        .background(Color.white)
        .ignoresSafeArea(edges: .top)
        .onAppear {
            scheduleAddressBarAutoHide()
        }
        .onChange(of: addressBarHidden) { _, hidden in
            if hidden {
                cancelAddressBarAutoHide()
            } else {
                scheduleAddressBarAutoHide()
            }
        }
        .onChange(of: addressBarFocused) { _, focused in
            if focused {
                cancelAddressBarAutoHide()
                addressBarHidden = false
            } else {
                scheduleAddressBarAutoHide()
            }
        }
        .sheet(item: $model.nip07PermissionPrompt) { prompt in
            NIP07PermissionPromptSheet(
                prompt: prompt,
                dismiss: {
                    model.nip07PermissionPrompt = nil
                }
            )
            .presentationDetents([.height(320)])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled()
        }
        .onDisappear {
            cancelAddressBarAutoHide()
        }
        .onReceive(NotificationCenter.default.publisher(for: .vibePushNotificationTapped)) { notification in
            let plusCode = notification.userInfo?["plusCode"] as? String ?? ""
            model.handleNotificationTap(plusCode: plusCode)
        }
    }

    private func scheduleAddressBarAutoHide() {
        guard !addressBarHidden, !addressBarFocused else { return }
        cancelAddressBarAutoHide()
        addressBarAutoHideTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run {
                guard !addressBarFocused else { return }
                addressBarHidden = true
            }
        }
    }

    private func cancelAddressBarAutoHide() {
        addressBarAutoHideTask?.cancel()
        addressBarAutoHideTask = nil
    }
}

private struct NIP07PermissionPromptSheet: View {
    let prompt: NIP07PermissionPrompt
    let dismiss: () -> Void
    @State private var rememberWebsite = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Allow NIP-07 key access?")
                    .font(.title3.bold())
                Text("\(prompt.host) wants to use your Nostr key in Nostroots iOS. Allow this only for websites you trust.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                rememberWebsite.toggle()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: rememberWebsite ? "checkmark.square.fill" : "square")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(rememberWebsite ? Color(red: 0.05, green: 0.68, blue: 0.55) : .secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Remember this website")
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Text("Allow \(prompt.host) to use NIP-07 without asking again.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)

            HStack(spacing: 12) {
                Button {
                    prompt.deny()
                    dismiss()
                } label: {
                    Text("Don't allow")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    prompt.allow(rememberWebsite)
                    dismiss()
                } label: {
                    Text("Allow")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.05, green: 0.68, blue: 0.55))
            }
        }
        .padding(22)
        .background(Color(.systemGroupedBackground))
    }
}

private struct BrowserHeader: View {
    @Binding var showingSettings: Bool
    let goHome: () -> Void

    var body: some View {
        HStack {
            Button {
                goHome()
            } label: {
                Image("Logo67")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 38, height: 38)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel("Open Nostroots")
            Spacer()
            Button {
                showingSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
            }
            .accessibilityLabel("Settings")
        }
        .padding(.leading, 28)
        .padding(.trailing, 20)
        .padding(.vertical, 9)
        .frame(height: 56)
        .background(Color(red: 0.05, green: 0.68, blue: 0.55))
    }
}

private struct AddressBar: View {
    @ObservedObject var model: BrowserAppModel
    @FocusState.Binding var isFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            TextField("Web address", text: $model.currentURLString)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .submitLabel(.go)
                .focused($isFocused)
                .onSubmit {
                    model.loadAddressBarURL()
                    isFocused = false
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))

            Button("Go") {
                model.loadAddressBarURL()
                isFocused = false
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(height: 44)
            .padding(.horizontal, 18)
            .background(Color(red: 0.05, green: 0.68, blue: 0.55), in: RoundedRectangle(cornerRadius: 8))
        }
        .padding(10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(.separator).opacity(0.22)))
        .shadow(color: .black.opacity(0.14), radius: 18, y: 8)
    }
}
