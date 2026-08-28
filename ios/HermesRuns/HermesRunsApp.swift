import SwiftUI

@main
struct HermesRunsApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView(session: session)
                .preferredColorScheme(.light)
        }
    }
}
