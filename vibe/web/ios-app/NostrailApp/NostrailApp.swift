import SwiftUI

@main
struct NostrailApp: App {
    @StateObject private var sharingService = LocationSharingService()

    var body: some Scene {
        WindowGroup {
            NostrailRootView(sharingService: sharingService)
        }
    }
}

