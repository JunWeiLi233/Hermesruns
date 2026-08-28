import SwiftUI

struct MainTabView: View {
    @ObservedObject var session: SessionStore
    @State private var selectedTab = MainTab.today

    private enum MainTab: Hashable {
        case today, runs, shoes, more
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { TodayView(session: session) }
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(MainTab.today)
            NavigationStack { RunsView(session: session) }
                .tabItem { Label("Runs", systemImage: "figure.run") }
                .tag(MainTab.runs)
            NavigationStack { ShoesView(session: session) }
                .tabItem { Label("Shoes", systemImage: "shoeprints.fill") }
                .tag(MainTab.shoes)
            NavigationStack { MoreView(session: session) }
                .tabItem { Label("More", systemImage: "square.grid.2x2.fill") }
                .tag(MainTab.more)
        }
        .tint(HermesTheme.coral)
    }
}
