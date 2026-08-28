import SwiftUI

struct RootView: View {
    @ObservedObject var session: SessionStore

    var body: some View {
        Group {
            if session.phase == .restoring {
                LaunchView()
            } else if session.isAuthenticated {
                MainTabView(session: session)
            } else {
                NavigationStack { LoginView(session: session) }
            }
        }
        .tint(HermesTheme.coral)
        .task {
            if session.phase == .restoring { await session.restore() }
        }
    }
}

private struct LaunchView: View {
    var body: some View {
        ZStack {
            HermesTheme.ink.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 10) {
                Text("HERMES")
                    .font(.system(size: 42, weight: .black, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(.white)
                Text("RUN WITH CONTEXT")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .tracking(2)
                    .foregroundStyle(HermesTheme.coralSoft)
                ProgressView()
                    .tint(HermesTheme.coralSoft)
                    .padding(.top, 28)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(28)
        }
    }
}
