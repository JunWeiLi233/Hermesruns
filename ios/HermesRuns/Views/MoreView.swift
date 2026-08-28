import SwiftUI

struct MoreView: View {
    @ObservedObject var session: SessionStore

    var body: some View {
        List {
            Section {
                MoreLink(title: "Analysis", subtitle: "Training load and recent performance", icon: "waveform.path.ecg") {
                    AnalysisView(session: session)
                }
                MoreLink(title: "Schedule", subtitle: "Your next 14 coached days", icon: "calendar") {
                    ScheduleView(session: session)
                }
                MoreLink(title: "Races", subtitle: "Targets, countdowns, and course context", icon: "flag.checkered") {
                    RacesView(session: session)
                }
                MoreLink(title: "Strength", subtitle: "Training plan and today's check-in", icon: "figure.strengthtraining.traditional") {
                    MuscleTrainingView(session: session)
                }
                MoreLink(title: "Wellness", subtitle: "Soreness and training-load signals", icon: "heart.text.square") {
                    WellnessView(session: session)
                }
                MoreLink(title: "Strava", subtitle: "Connect and sync recent runs", icon: "arrow.triangle.2.circlepath") {
                    StravaSyncView(session: session)
                }
                MoreLink(title: "Import data", subtitle: "Bring in GPX, TCX, FIT, or ZIP exports", icon: "square.and.arrow.down") {
                    ImportDataView(session: session)
                }
                MoreLink(title: "Weather", subtitle: "Acclimatization and pace context", icon: "cloud.sun.fill") {
                    WeatherView(session: session)
                }
                MoreLink(title: "Rewards", subtitle: "Progress built from your logged runs", icon: "rosette") {
                    RewardsView(session: session)
                }
            } header: {
                HermesSectionLabel(text: "Runner tools")
                    .textCase(nil)
            }

            Section {
                MoreLink(title: "Profile", subtitle: "Account and connected services", icon: "person.crop.circle") {
                    ProfileView(session: session)
                }
                MoreLink(title: "Settings", subtitle: "Connection and session controls", icon: "slider.horizontal.3") {
                    SettingsView(session: session)
                }
            } header: {
                HermesSectionLabel(text: "Account")
                    .textCase(nil)
            }

            Section {
                Text("Admin operations, GPS heatmaps, and race maps remain available in the Hermes web app while their native flows are added.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .padding(.vertical, 8)
            }
        }
        .scrollContentBackground(.hidden)
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct MoreLink<Destination: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    private let destination: () -> Destination

    init(
        title: String,
        subtitle: String,
        icon: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.destination = destination
    }

    var body: some View {
        NavigationLink(destination: destination()) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(HermesTheme.coral)
                    .frame(width: 40, height: 40)
                    .background(HermesTheme.coralSoft, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(HermesTheme.ink)
                    Text(subtitle)
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }
            }
            .padding(.vertical, 5)
        }
        .listRowBackground(HermesTheme.paperRaised)
    }
}

struct MoreView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { MoreView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
