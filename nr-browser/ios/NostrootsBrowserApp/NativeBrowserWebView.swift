import SwiftUI
import WebKit
import UIKit

struct NativeBrowserWebView: UIViewRepresentable {
    let url: URL
    let reloadID: UUID
    let developerMode: Bool
    let keyStore: KeyStore
    let cryptoProvider: NostrCryptoProviding
    let permissionStore: NIP07PermissionStoring
    let requestNIP07Permission: @MainActor (NIP07PermissionPrompt) -> Void
    @Binding var currentURLString: String
    @Binding var addressBarHidden: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(
            keyStore: keyStore,
            cryptoProvider: cryptoProvider,
            permissionStore: permissionStore,
            requestNIP07Permission: requestNIP07Permission,
            currentURLString: $currentURLString,
            addressBarHidden: $addressBarHidden,
            developerMode: developerMode
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let userContent = WKUserContentController()
        userContent.addUserScript(WKUserScript(
            source: Self.injectedNostrScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        userContent.add(context.coordinator, name: "nostrootsNip7")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContent
        configuration.applicationNameForUserAgent = "NostrootsBrowser/1.0"

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.customUserAgent = "NostrootsBrowser/1.0 Mobile WKWebView"
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.delegate = context.coordinator
        webView.load(URLRequest(url: url))
        context.coordinator.webView = webView
        context.coordinator.lastReloadID = reloadID
        context.coordinator.lastScrollY = webView.scrollView.contentOffset.y
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.developerMode = developerMode
        if !developerMode {
            context.coordinator.lastScrollY = webView.scrollView.contentOffset.y
            addressBarHidden = false
        }
        if context.coordinator.lastReloadID != reloadID {
            context.coordinator.lastReloadID = reloadID
            webView.load(URLRequest(url: url))
        }
    }

    static let injectedNostrScript = """
    (function() {
      if (window.nostr && window.nostr.__nostrootsBrowser) return;
      var pending = {};
      var seq = 0;

      function request(method, params) {
        return new Promise(function(resolve, reject) {
          var id = 'nr-browser-' + Date.now() + '-' + (++seq);
          pending[id] = { resolve: resolve, reject: reject };
          window.webkit.messageHandlers.nostrootsNip7.postMessage({
            source: 'nostroots-nip7-bridge',
            id: id,
            method: method,
            params: params || []
          });
        });
      }

      window.__nostrootsNip7Receive = function(response) {
        var callback = pending[response.id];
        if (!callback) return;
        delete pending[response.id];
        if (response.ok) callback.resolve(response.result);
        else callback.reject(new Error(response.error || 'Nostroots Browser signing failed.'));
      };

      window.nostr = {
        __nostrootsBrowser: true,
        getPublicKey: function() {
          return request('getPublicKey', []);
        },
        signEvent: function(event) {
          return request('signEvent', [event]);
        },
        nip44: {
          encrypt: function(peerPubkey, plaintext) {
            return request('nip44.encrypt', [peerPubkey, plaintext]);
          },
          decrypt: function(peerPubkey, ciphertext) {
            return request('nip44.decrypt', [peerPubkey, ciphertext]);
          }
        },
        nip04: {
          encrypt: function(peerPubkey, plaintext) {
            return request('nip04.encrypt', [peerPubkey, plaintext]);
          },
          decrypt: function(peerPubkey, ciphertext) {
            return request('nip04.decrypt', [peerPubkey, ciphertext]);
          }
        }
      };
    })();
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, UIScrollViewDelegate {
        weak var webView: WKWebView?
        var lastReloadID: UUID?
        var lastScrollY: CGFloat = 0
        var developerMode: Bool
        private var accumulatedScrollDelta: CGFloat = 0
        private let policy = BrowserNavigationPolicy()
        private let permissionPolicy = NIP07PermissionPolicy()
        private let permissionStore: NIP07PermissionStoring
        private let bridge: NIP07Bridge
        private let requestPermission: @MainActor (NIP07PermissionPrompt) -> Void
        private var pendingPermissionMessages: [String: [Any]] = [:]
        @Binding private var currentURLString: String
        @Binding private var addressBarHidden: Bool

        init(
            keyStore: KeyStore,
            cryptoProvider: NostrCryptoProviding,
            permissionStore: NIP07PermissionStoring,
            requestNIP07Permission: @escaping @MainActor (NIP07PermissionPrompt) -> Void,
            currentURLString: Binding<String>,
            addressBarHidden: Binding<Bool>,
            developerMode: Bool
        ) {
            self.bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: cryptoProvider)
            self.permissionStore = permissionStore
            self.requestPermission = requestNIP07Permission
            self._currentURLString = currentURLString
            self._addressBarHidden = addressBarHidden
            self.developerMode = developerMode
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "nostrootsNip7" else { return }
            guard let metadata = requestMetadata(for: message.body) else {
                send(bridge.handle(message.body))
                return
            }
            guard NIP07Bridge.knownMethods.contains(metadata.method) else {
                send(bridge.handle(message.body))
                return
            }
            guard let origin = permissionPolicy.origin(for: webView?.url) else {
                send(.failure(id: metadata.id, error: .permissionDenied))
                return
            }
            if permissionPolicy.isAutoAllowed(origin: origin) {
                permissionStore.recordTrustedUse(origin: origin)
                send(bridge.handle(message.body))
                return
            }
            guard permissionStore.isAllowed(origin: origin) else {
                enqueuePermissionPrompt(origin: origin, method: metadata.method, body: message.body)
                return
            }

            let response = bridge.handle(message.body)
            send(response)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            currentURLString = webView.url?.absoluteString ?? currentURLString
            lastScrollY = webView.scrollView.contentOffset.y
            if developerMode {
                addressBarHidden = false
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(.allow)
                return
            }

            switch policy.decision(for: navigationAction.request.url, developerMode: developerMode) {
            case .allow:
                decisionHandler(.allow)
            case .openExternally:
                if let url = navigationAction.request.url {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
            case .cancel:
                decisionHandler(.cancel)
            }
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            guard developerMode else { return }

            let y = scrollView.contentOffset.y
            let delta = y - lastScrollY
            defer { lastScrollY = y }

            if y < 12 {
                accumulatedScrollDelta = 0
                addressBarHidden = false
                return
            }

            if delta.sign == accumulatedScrollDelta.sign || abs(accumulatedScrollDelta) < 0.5 {
                accumulatedScrollDelta += delta
            } else {
                accumulatedScrollDelta = delta
            }

            if accumulatedScrollDelta > 28 {
                addressBarHidden = true
                accumulatedScrollDelta = 0
            } else if accumulatedScrollDelta < -18 {
                addressBarHidden = false
                accumulatedScrollDelta = 0
            }
        }

        private func send(_ response: NIP07BridgeResponse) {
            guard
                let data = try? JSONSerialization.data(withJSONObject: response.jsonObject(), options: []),
                let json = String(data: data, encoding: .utf8)
            else {
                return
            }
            webView?.evaluateJavaScript("window.__nostrootsNip7Receive(\(json));")
        }

        private func requestMetadata(for raw: Any) -> (id: String, method: String)? {
            guard
                let message = raw as? [String: Any],
                message["source"] as? String == "nostroots-nip7-bridge",
                let id = message["id"] as? String,
                let method = message["method"] as? String
            else {
                return nil
            }
            return (id, method)
        }

        private func enqueuePermissionPrompt(origin: String, method: String, body: Any) {
            var messages = pendingPermissionMessages[origin] ?? []
            messages.append(body)
            pendingPermissionMessages[origin] = messages
            guard messages.count == 1 else { return }

            let host = permissionPolicy.host(for: origin)
            let prompt = NIP07PermissionPrompt(
                origin: origin,
                host: host,
                method: method,
                allow: { [weak self] remember in
                    self?.allowPendingMessages(for: origin, remember: remember)
                },
                deny: { [weak self] in
                    self?.denyPendingMessages(for: origin)
                }
            )
            Task { @MainActor in
                requestPermission(prompt)
            }
        }

        private func allowPendingMessages(for origin: String, remember: Bool) {
            if remember {
                permissionStore.allow(origin: origin)
            }
            let messages = pendingPermissionMessages.removeValue(forKey: origin) ?? []
            for body in messages {
                send(bridge.handle(body))
            }
        }

        private func denyPendingMessages(for origin: String) {
            let messages = pendingPermissionMessages.removeValue(forKey: origin) ?? []
            for body in messages {
                guard let id = requestMetadata(for: body)?.id else { continue }
                send(.failure(id: id, error: .permissionDenied))
            }
        }
    }
}
