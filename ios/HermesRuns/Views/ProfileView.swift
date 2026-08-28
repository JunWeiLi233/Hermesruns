import SwiftUI

struct ProfileView: View {
    @ObservedObject var session: SessionStore

    private var snapshot: HermesDashboardSnapshot? {
        guard let dashboard = session.dashboard else { return nil }
        return HermesDashboardSnapshot(payload: dashboard)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let snapshot {
                    HStack(spacing: 14) {
                        Text(initial)
                            .font(.system(size: 26, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .frame(width: 66, height: 66)
                            .background(HermesTheme.ink, in: Circle())
                        VStack(alignment: .leading, spacing: 5) {
                            Text(snapshot.displayName)
                                .font(HermesTheme.title)
                                .foregroundStyle(HermesTheme.ink)
                            Text(session.email ?? snapshot.profile?.email ?? "")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk)
                        }
                    }
                    .padding(.top, 8)

                    HermesSectionLabel(text: "Runner context")
                    HermesCard {
                        HStack(spacing: 0) {
                            HermesMetric(value: "\(snapshot.recentRuns.count)", label: "runs loaded")
                            HermesMetric(value: HermesFormatters.distance(snapshot.weeklyDistanceKm), label: "7-day volume")
                            HermesMetric(value: "\(snapshot.activeShoes.count)", label: "active shoes")
                        }
                    }

                    HermesSectionLabel(text: "Connected services")
                    NavigationLink(destination: StravaSyncView(session: session)) {
                        HermesCard {
                            HStack {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .foregroundStyle(snapshot.profile?.stravaLinked == true ? HermesTheme.mintInk : HermesTheme.mutedInk)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Strava")
                                        .font(.system(size: 16, weight: .bold, design: .rounded))
                                    Text(snapshot.profile?.stravaLinked == true ? "Connected" : "Not connected")
                                        .font(HermesTheme.caption)
                                        .foregroundStyle(HermesTheme.mutedInk)
                                }
                                Spacer()
                                Image(systemName: snapshot.profile?.stravaLinked == true ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(snapshot.profile?.stravaLinked == true ? HermesTheme.mintInk : HermesTheme.mutedInk)
                            }
                        }
                    }
                    Text("Use Settings to update your display name and runner preferences. File imports remain on the Hermes web app while their native flow is added.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    ProgressView().tint(HermesTheme.coral).frame(maxWidth: .infinity).padding(.vertical, 50)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { if session.dashboard == nil { await session.refreshDashboard() } }
    }

    private var initial: String {
        guard let first = snapshot?.displayName.first else { return "H" }
        return String(first)
    }
}

struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { ProfileView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
