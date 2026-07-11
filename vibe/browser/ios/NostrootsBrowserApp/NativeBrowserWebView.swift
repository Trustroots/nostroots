import SwiftUI
import WebKit
import UIKit

struct NativeBrowserWebView: UIViewRepresentable {
    let url: URL
    let reloadID: UUID
    let keyStore: KeyStore
    let cryptoProvider: NostrCryptoProviding
    let permissionStore: NIP07PermissionStoring
    let pushNotifications: VibePushNotificationManager
    let requestNIP07Permission: @MainActor (NIP07PermissionPrompt) -> Void
    @Binding var currentURLString: String
    @Binding var addressBarHidden: Bool
    @Binding var pendingNotificationPlusCode: String?

    func makeCoordinator() -> Coordinator {
        Coordinator(
            keyStore: keyStore,
            cryptoProvider: cryptoProvider,
            permissionStore: permissionStore,
            pushNotifications: pushNotifications,
            requestNIP07Permission: requestNIP07Permission,
            currentURLString: $currentURLString,
            addressBarHidden: $addressBarHidden,
            pendingNotificationPlusCode: $pendingNotificationPlusCode
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
        userContent.addUserScript(WKUserScript(
            source: Self.injectedNotificationsScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        userContent.add(context.coordinator, name: "nostrootsNotifications")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContent
        configuration.applicationNameForUserAgent = "NostrootsBrowser/1.0 iOS-native"

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.customUserAgent = "NostrootsBrowser/1.0 iOS-native"
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
        if context.coordinator.lastReloadID != reloadID {
            context.coordinator.lastReloadID = reloadID
            webView.load(URLRequest(url: url))
        }
        context.coordinator.openPendingNotificationPlusCodeIfNeeded()
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
        else callback.reject(new Error(response.error || 'Nostroots iOS signing failed.'));
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

    static let injectedNotificationsScript = """
    (function() {
      window.nostrootsBrowser = window.nostrootsBrowser || {};
      if (window.nostrootsBrowser.notifications && window.nostrootsBrowser.notifications.__native) return;
      var pending = {};
      var seq = 0;

      function request(method, params) {
        return new Promise(function(resolve, reject) {
          var id = 'nr-browser-notifications-' + Date.now() + '-' + (++seq);
          pending[id] = { resolve: resolve, reject: reject };
          window.webkit.messageHandlers.nostrootsNotifications.postMessage({
            source: 'nostroots-notifications-bridge',
            id: id,
            method: method,
            params: params || []
          });
        });
      }

      window.__nostrootsNotificationsReceive = function(response) {
        var callback = pending[response.id];
        if (!callback) return;
        delete pending[response.id];
        if (response.ok) callback.resolve(response.result);
        else callback.reject(new Error(response.error || 'Nostroots iOS notification action failed.'));
      };

      window.nostrootsBrowser.notifications = {
        __native: true,
        getState: function() { return request('getState', []); },
        enable: function() { return request('enable', []); },
        disable: function() { return request('disable', []); },
        subscribePlusCode: function(plusCode) { return request('subscribePlusCode', [plusCode]); },
        unsubscribePlusCode: function(plusCode) { return request('unsubscribePlusCode', [plusCode]); },
        sendTestNotification: function() { return request('sendTestNotification', []); }
      };
    })();
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, UIScrollViewDelegate {
        weak var webView: WKWebView?
        var lastReloadID: UUID?
        var lastScrollY: CGFloat = 0
        private var accumulatedScrollDelta: CGFloat = 0
        private let policy = BrowserNavigationPolicy()
        private let permissionPolicy = NIP07PermissionPolicy()
        private let permissionStore: NIP07PermissionStoring
        private let bridge: NIP07Bridge
        private let notificationBridge: VibeNotificationBridge
        private let requestPermission: @MainActor (NIP07PermissionPrompt) -> Void
        private var pendingPermissionMessages: [String: [Any]] = [:]
        @Binding private var currentURLString: String
        @Binding private var addressBarHidden: Bool
        @Binding private var pendingNotificationPlusCode: String?

        init(
            keyStore: KeyStore,
            cryptoProvider: NostrCryptoProviding,
            permissionStore: NIP07PermissionStoring,
            pushNotifications: VibePushNotificationManager,
            requestNIP07Permission: @escaping @MainActor (NIP07PermissionPrompt) -> Void,
            currentURLString: Binding<String>,
            addressBarHidden: Binding<Bool>,
            pendingNotificationPlusCode: Binding<String?>
        ) {
            self.bridge = NIP07Bridge(keyStore: keyStore, cryptoProvider: cryptoProvider)
            self.notificationBridge = VibeNotificationBridge(manager: pushNotifications)
            self.permissionStore = permissionStore
            self.requestPermission = requestNIP07Permission
            self._currentURLString = currentURLString
            self._addressBarHidden = addressBarHidden
            self._pendingNotificationPlusCode = pendingNotificationPlusCode
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "nostrootsNotifications" {
                Task { @MainActor in
                    let response = await notificationBridge.handle(message.body)
                    sendNotificationResponse(response)
                }
                return
            }
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
            addressBarHidden = false
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

            switch policy.decision(for: navigationAction.request.url) {
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

        private func sendNotificationResponse(_ response: VibeNotificationBridgeResponse) {
            guard
                let data = try? JSONSerialization.data(withJSONObject: response.jsonObject(), options: []),
                let json = String(data: data, encoding: .utf8)
            else {
                return
            }
            webView?.evaluateJavaScript("window.__nostrootsNotificationsReceive(\(json));")
        }

        func openPendingNotificationPlusCodeIfNeeded() {
            guard let plusCode = pendingNotificationPlusCode, !plusCode.isEmpty else { return }
            pendingNotificationPlusCode = nil
            let encoded = (try? JSONSerialization.data(withJSONObject: [plusCode], options: []))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\(plusCode)\"]"
            webView?.evaluateJavaScript("""
            (function(args) {
              var plusCode = args[0];
              if (window.NrWebUnifiedNavigateToMapPlusCode) {
                window.NrWebUnifiedNavigateToMapPlusCode(plusCode);
              } else {
                window.location.hash = encodeURIComponent(plusCode).replace(/%2B/g, '+');
              }
            })(\(encoded));
            """)
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
