import SwiftUI

@main
struct NostrootsBrowserApp: App {
    @StateObject private var model = BrowserAppModel()

    var body: some Scene {
        WindowGroup {
            NostrootsBrowserRootView(model: model)
                .statusBarHidden(true)
        }
    }
}
