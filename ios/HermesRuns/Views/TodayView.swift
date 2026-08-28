import Foundation
import SwiftUI

struct TodayView: View {
    @ObservedObject var session: SessionStore

    private var snapshot: HermesDashboardSnapshot? {
        guard let dashboard = session.dashboard else { return nil }
        return HermesDashboardSnapshot(payload: dashboard)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let snapshot {
                    todayContent(snapshot)
                } else if session.phase == .loading || session.phase == .restoring {
                    loadingContent
                } else {
                    emptyContent
                }

                if let error = session.errorMessage, session.phase == .failed {
                    HermesCard {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.coral)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await session.refreshDashboard() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .accessibilityLabel("Refresh today's coaching")
            }
        }
        .refreshable { await session.refreshDashboard() }
        .task {
            if session.dashboard == nil { await session.refreshDashboard() }
        }
    }

    @ViewBuilder
    private func todayContent(_ snapshot: HermesDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.mutedInk)
            Text("Good morning, \(snapshot.displayName)")
                .font(HermesTheme.display)
                .foregroundStyle(HermesTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }

        HermesCard(fill: HermesTheme.ink) {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        HermesSectionLabel(text: "Today's call")
                            .foregroundStyle(HermesTheme.coralSoft)
                        Text(snapshot.readinessLabel)
                            .font(.system(size: 24, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text(snapshot.coach?.coachMessage ?? "Hermes is ready to help you choose the right effort for today.")
                            .font(HermesTheme.body)
                            .foregroundStyle(.white.opacity(0.72))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 12)
                    ReadinessRing(score: snapshot.readinessScore)
                        .frame(width: 112, height: 112)
                }
                HStack(spacing: 18) {
                    HermesMetric(value: HermesFormatters.distance(snapshot.weeklyDistanceKm), label: "7-day volume", valueColor: .white, labelColor: .white.opacity(0.62))
                    HermesMetric(value: HermesFormatters.plannedTime(minutes: snapshot.workoutDurationMinutes), label: "today", valueColor: .white, labelColor: .white.opacity(0.62))
                }
            }
        }

        HermesSectionLabel(text: "Run blueprint")
        HermesCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline) {
                    Text(snapshot.workoutTitle)
                        .font(HermesTheme.title)
                        .foregroundStyle(HermesTheme.ink)
                    Spacer()
                    if snapshot.workout?.readinessAdjusted == true {
                        Text("Adjusted")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(HermesTheme.mint, in: Capsule())
                    }
                }
                Text(snapshot.workout?.notes ?? "Keep the effort controlled and finish with enough left to recover well.")
                    .font(HermesTheme.body)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 0) {
                    HermesMetric(value: HermesFormatters.distance(snapshot.workoutDistanceKm), label: "distance")
                    HermesMetric(value: HermesFormatters.plannedTime(minutes: snapshot.workoutDurationMinutes), label: "duration")
                    HermesMetric(value: paceRange(snapshot.workout), label: "pace")
                }
            }
        }

        if let shoe = snapshot.recommendedShoe {
            HermesSectionLabel(text: "Shoe guidance")
            HermesCard(fill: HermesTheme.coralSoft) {
                HStack(spacing: 14) {
                    Image(systemName: "shoeprints.fill")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(HermesTheme.coral)
                        .frame(width: 48, height: 48)
                        .background(.white.opacity(0.72), in: Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text([shoe.brand, shoe.model].compactMap { $0 }.joined(separator: " ").ifEmpty("Rotation pick"))
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundStyle(HermesTheme.ink)
                        Text(shoe.recommendationReason ?? "Best match for today's session")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.ink.opacity(0.66))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
            }
        }

        if !snapshot.recentRuns.isEmpty {
            HStack {
                HermesSectionLabel(text: "Recent runs")
                Spacer()
                Text("Last \(min(3, snapshot.recentRuns.count))")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
            }
            HermesCard {
                VStack(spacing: 0) {
                    ForEach(Array(snapshot.recentRuns.prefix(3).enumerated()), id: \.offset) { _, run in
                        RunSummaryRow(run: run)
                        if run.id != snapshot.recentRuns.prefix(3).last?.id {
                            Divider().overlay(HermesTheme.line)
                        }
                    }
                }
            }
        }
    }

    private var loadingContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            ProgressView()
                .tint(HermesTheme.coral)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 48)
            Text("Loading your running context…")
                .font(HermesTheme.body)
                .foregroundStyle(HermesTheme.mutedInk)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your next run starts here.")
                .font(HermesTheme.display)
                .foregroundStyle(HermesTheme.ink)
            HermesCard(fill: HermesTheme.ink) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("CONNECT YOUR RUNNING DATA")
                        .font(HermesTheme.section)
                        .tracking(1)
                        .foregroundStyle(HermesTheme.coralSoft)
                    Text("Sign in to a Hermes backend to see readiness, training guidance, and shoe rotation.")
                        .font(HermesTheme.body)
                        .foregroundStyle(.white.opacity(0.78))
                }
            }
        }
    }

    private func paceRange(_ workout: HermesScheduledWorkout?) -> String {
        guard let min = workout?.targetPaceMinSecondsPerKm, let max = workout?.targetPaceMaxSecondsPerKm else { return "—" }
        return "\(min / 60):\(String(format: "%02d", min % 60))–\(max / 60):\(String(format: "%02d", max % 60))"
    }
}

private struct RunSummaryRow: View {
    let run: HermesRun

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.run")
                .foregroundStyle(HermesTheme.coral)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 4) {
                Text(run.name?.isEmpty == false ? run.name! : "Run")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(HermesTheme.ink)
                    .lineLimit(1)
                Text(HermesFormatters.date(run.displayDate))
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(HermesFormatters.distance(run.resolvedDistanceKm))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(HermesTheme.ink)
                Text(HermesFormatters.pace(distanceKm: run.resolvedDistanceKm, seconds: run.resolvedDurationSeconds))
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
            }
        }
        .padding(.vertical, 12)
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}

struct TodayView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { TodayView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
