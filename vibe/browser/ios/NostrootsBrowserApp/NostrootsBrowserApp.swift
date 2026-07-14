import SwiftUI
import UIKit

@main
struct NostrootsBrowserApp: App {
    @UIApplicationDelegateAdaptor(NostrootsBrowserAppDelegate.self) private var appDelegate
    @StateObject private var model = BrowserAppModel()

    var body: some Scene {
        WindowGroup {
            NostrootsBrowserRootView(model: model)
                .statusBarHidden(true)
        }
    }
}

final class NostrootsBrowserAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            VibePushNotificationManager.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            VibePushNotificationManager.shared.didFailToRegisterForRemoteNotifications(error: error)
        }
    }
}
