import Foundation
import SwiftUI

struct RewardsView: View {
    @ObservedObject var session: SessionStore

    private var runs: [HermesRun] {
        guard let dashboard = session.dashboard else { return [] }
        return HermesDashboardSnapshot(payload: dashboard).recentRuns
    }

    private var totalDistance: Double { runs.reduce(0) { $0 + $1.resolvedDistanceKm } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Rewards")
                Text("Consistency compounds.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                HermesCard(fill: HermesTheme.ink) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("RUNNER LEDGER")
                            .font(HermesTheme.section)
                            .tracking(1)
                            .foregroundStyle(HermesTheme.coralSoft)
                        Text("\(runs.count) runs logged")
                            .font(.system(size: 25, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("\(String(format: "%.1f", totalDistance)) km of context for your next decision.")
                            .font(HermesTheme.body)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
                HermesSectionLabel(text: "Milestones")
                ForEach(milestones, id: \.title) { milestone in
                    MilestoneRow(milestone: milestone)
                }
                Text("The native ledger mirrors the progress signal from Hermes runs. Badge catalog details and cosmetics remain available on the web Rewards route.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Rewards")
        .navigationBarTitleDisplayMode(.inline)
        .task { if session.dashboard == nil { await session.refreshDashboard() } }
    }

    private var milestones: [Milestone] {
        [50, 100, 250].map { threshold in
            Milestone(title: "\(threshold) km base", progress: min(1, totalDistance / Double(threshold)))
        }
    }
}

private struct Milestone: Hashable {
    let title: String
    let progress: Double
}

private struct MilestoneRow: View {
    let milestone: Milestone

    var body: some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(milestone.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(HermesTheme.ink)
                    Spacer()
                    Text("\(Int(milestone.progress * 100))%")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                }
                ProgressView(value: milestone.progress)
                    .tint(milestone.progress >= 1 ? HermesTheme.mintInk : HermesTheme.coral)
            }
        }
    }
}

struct RewardsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { RewardsView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
