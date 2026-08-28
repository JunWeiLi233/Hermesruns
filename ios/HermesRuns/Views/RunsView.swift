import SwiftUI

struct RunsView: View {
    @ObservedObject var session: SessionStore

    private var runs: [HermesRun] {
        guard let dashboard = session.dashboard else { return [] }
        return HermesDashboardSnapshot(payload: dashboard).recentRuns
    }

    var body: some View {
        List {
            Section {
                if runs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("No runs yet")
                            .font(HermesTheme.title)
                        Text("Import a run or connect Strava from the Hermes web app to start building your history.")
                            .font(HermesTheme.body)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                    .padding(.vertical, 20)
                    .listRowBackground(HermesTheme.paperRaised)
                } else {
                    ForEach(Array(runs.enumerated()), id: \.offset) { _, run in
                        NavigationLink {
                            RunDetailView(session: session, run: run)
                        } label: {
                            RunListRow(run: run)
                        }
                            .listRowBackground(HermesTheme.paperRaised)
                    }
                }
            } header: {
                HermesSectionLabel(text: "Run history")
                    .textCase(nil)
            }
        }
        .scrollContentBackground(.hidden)
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Runs")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await session.refreshDashboard() }
        .task {
            if session.dashboard == nil { await session.refreshDashboard() }
        }
    }
}

private struct RunListRow: View {
    let run: HermesRun

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(run.name?.isEmpty == false ? run.name! : "Run")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(HermesTheme.ink)
                    .lineLimit(1)
                Text(HermesFormatters.date(run.displayDate))
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Text(HermesFormatters.distance(run.resolvedDistanceKm))
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(HermesTheme.ink)
                HStack(spacing: 8) {
                    Text(HermesFormatters.duration(run.resolvedDurationSeconds))
                    Text(HermesFormatters.pace(distanceKm: run.resolvedDistanceKm, seconds: run.resolvedDurationSeconds))
                }
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.mutedInk)
            }
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(run.name ?? "Run"), \(HermesFormatters.distance(run.resolvedDistanceKm)), \(HermesFormatters.duration(run.resolvedDurationSeconds))")
    }
}

struct RunsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { RunsView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
