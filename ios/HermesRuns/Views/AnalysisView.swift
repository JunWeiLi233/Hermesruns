import Foundation
import SwiftUI

struct AnalysisView: View {
    @ObservedObject var session: SessionStore

    private var snapshot: HermesDashboardSnapshot? {
        guard let dashboard = session.dashboard else { return nil }
        return HermesDashboardSnapshot(payload: dashboard)
    }

    private var runs: [HermesRun] {
        if !session.analysisRuns.isEmpty { return session.analysisRuns }
        return snapshot?.recentRuns ?? []
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Training analysis")
                Text("See the signal behind the miles.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if let snapshot {
                    let total = runs.reduce(0) { $0 + $1.resolvedDistanceKm }
                    let longest = runs.map(\.resolvedDistanceKm).max() ?? 0
                    let pace = averagePace(runs)
                    HermesCard(fill: HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("RECENT TRAINING SNAPSHOT")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(HermesTheme.coralSoft)
                            HStack(spacing: 0) {
                                HermesMetric(value: HermesFormatters.distance(total), label: "loaded", valueColor: .white, labelColor: .white.opacity(0.62))
                                HermesMetric(value: HermesFormatters.pace(distanceKm: 1, seconds: pace), label: "average pace", valueColor: .white, labelColor: .white.opacity(0.62))
                                HermesMetric(value: HermesFormatters.distance(longest), label: "longest", valueColor: .white, labelColor: .white.opacity(0.62))
                            }
                        }
                    }

                    HermesSectionLabel(text: "Activity signal")
                    HermesCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Recent pace and heart-rate context")
                                .font(HermesTheme.title)
                                .foregroundStyle(HermesTheme.ink)
                            ForEach(Array(runs.prefix(7).enumerated()), id: \.offset) { _, run in
                                HStack {
                                    Text(HermesFormatters.date(run.displayDate))
                                        .font(HermesTheme.caption)
                                        .foregroundStyle(HermesTheme.mutedInk)
                                        .frame(width: 54, alignment: .leading)
                                    GeometryReader { proxy in
                                        let width = max(8, min(proxy.size.width, CGFloat(run.resolvedDistanceKm / max(longest, 1)) * proxy.size.width))
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .fill(HermesTheme.coral)
                                            .frame(width: width, height: 10)
                                            .frame(maxHeight: .infinity, alignment: .center)
                                    }
                                    .frame(height: 22)
                                    Text(HermesFormatters.distance(run.resolvedDistanceKm))
                                        .font(HermesTheme.caption)
                                        .foregroundStyle(HermesTheme.ink)
                                        .frame(width: 52, alignment: .trailing)
                                }
                            }
                        }
                    }
                    Text("Hermes's full VDOT, ACWR, recovery, prediction, and trend methodology remains served by the existing Analysis web route. This native view keeps the first mobile surface legible and read-only.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    ProgressView().tint(HermesTheme.coral).frame(maxWidth: .infinity).padding(.vertical, 50)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Analysis")
        .navigationBarTitleDisplayMode(.inline)
        .task { if session.dashboard == nil { await session.refreshDashboard() } }
    }

    private func averagePace(_ runs: [HermesRun]) -> Double {
        let distance = runs.reduce(0) { $0 + $1.resolvedDistanceKm }
        let seconds = runs.reduce(0) { $0 + $1.resolvedDurationSeconds }
        return distance > 0 ? seconds / distance : 0
    }
}

struct AnalysisView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { AnalysisView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
