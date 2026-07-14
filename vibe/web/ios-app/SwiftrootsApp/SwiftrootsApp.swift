import SwiftUI

@main
struct SwiftrootsApp: App {
    @StateObject private var sharingService = LocationSharingService()

    var body: some Scene {
        WindowGroup {
            SwiftrootsRootView(sharingService: sharingService)
        }
    }
}

