import Foundation
import SwiftUI

struct WellnessView: View {
    @ObservedObject var session: SessionStore

    @State private var selectedLevel = "LOW"
    @State private var notes = ""
    @State private var isSubmitting = false
    @State private var notice = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Wellness")
                Text("Train with better signals.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if session.injuryRiskLoading && session.injuryRisk == nil {
                    ProgressView()
                        .tint(HermesTheme.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else if let assessment = session.injuryRisk {
                    assessmentContent(assessment)
                } else {
                    HermesCard(fill: HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("WELLNESS UNAVAILABLE")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(HermesTheme.coralSoft)
                            Text(session.injuryRiskErrorMessage ?? "Sign in to load your training-load and soreness signals.")
                                .font(HermesTheme.body)
                                .foregroundStyle(.white.opacity(0.78))
                                .fixedSize(horizontal: false, vertical: true)
                            Button("Try again") { Task { await session.refreshInjuryRisk() } }
                                .buttonStyle(HermesPrimaryButtonStyle())
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Wellness")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await session.refreshInjuryRisk() }
        .task {
            if session.injuryRisk == nil { await session.refreshInjuryRisk() }
            syncSelection()
        }
        .onChange(of: session.injuryRisk?.sorenessLevel) { _ in syncSelection() }
    }

    @ViewBuilder
    private func assessmentContent(_ assessment: HermesInjuryRiskAssessment) -> some View {
        HermesCard(fill: HermesTheme.ink) {
            VStack(alignment: .leading, spacing: 16) {
                Text("INJURY PREVENTION")
                    .font(HermesTheme.section)
                    .tracking(1)
                    .foregroundStyle(HermesTheme.coralSoft)
                HStack(alignment: .center, spacing: 18) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(display(assessment.risk ?? "LOW"))
                            .font(HermesTheme.title)
                            .foregroundStyle(.white)
                        Text(display(assessment.recommendation ?? "ready"))
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.coralSoft)
                    }
                    Spacer()
                    Text(assessment.combinedRiskScore.map { "\($0)%" } ?? "—")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(riskColor(assessment.risk))
                }
                ProgressView(value: Double(assessment.combinedRiskScore ?? 0), total: 100)
                    .tint(riskColor(assessment.risk))
                    .accessibilityLabel("Combined injury risk score")
                    .accessibilityValue(assessment.combinedRiskScore.map { "\($0) percent" } ?? "Unavailable")
                Text(assessment.coachVoice ?? assessment.coachAdvice ?? "Keep your training responsive to how you feel.")
                    .font(HermesTheme.body)
                    .foregroundStyle(.white.opacity(0.78))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }

        HermesCard {
            HStack(spacing: 0) {
                HermesMetric(value: assessment.acwr.map { String(format: "%.2f", $0) } ?? "—", label: "ACWR")
                HermesMetric(value: display(assessment.sorenessLevel ?? "—"), label: "today's soreness")
                HermesMetric(value: display(assessment.acwrTrend ?? "flat"), label: "load trend")
            }
        }

        sorenessCard

        if let logs = assessment.recentLogs, !logs.isEmpty {
            HermesSectionLabel(text: "Recent check-ins")
            HermesCard {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(logs.enumerated()), id: \.offset) { _, log in
                        HStack {
                            Text(HermesFormatters.date(HermesDate.parse(log.date)))
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk)
                            Spacer()
                            Text(display(log.level ?? "—"))
                                .font(HermesTheme.caption)
                                .foregroundStyle(riskColor(log.level))
                        }
                    }
                }
            }
        }

        if !notice.isEmpty {
            Text(notice)
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.mintInk)
        }
        if let error = session.injuryRiskErrorMessage, !error.isEmpty {
            Text(error)
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.coral)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var sorenessCard: some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 12) {
                HermesSectionLabel(text: "Today's soreness")
                Text("Log the signal that should shape your next session.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                HStack(spacing: 8) {
                    ForEach(["LOW", "MEDIUM", "HIGH"], id: \.self) { level in
                        SorenessChoice(
                            title: display(level),
                            isSelected: selectedLevel == level,
                            color: riskColor(level)
                        ) {
                            selectedLevel = level
                        }
                    }
                }
                TextEditor(text: $notes)
                    .frame(minHeight: 72)
                    .padding(8)
                    .scrollContentBackground(.hidden)
                    .background(HermesTheme.paper, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(alignment: .topLeading) {
                        if notes.isEmpty {
                            Text("Notes (optional)")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk.opacity(0.75))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 16)
                                .allowsHitTesting(false)
                        }
                    }
                Button {
                    submitSoreness()
                } label: {
                    HStack {
                        if isSubmitting { ProgressView().tint(.white) }
                        Text(isSubmitting ? "Saving…" : "Save soreness")
                    }
                }
                .buttonStyle(HermesPrimaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }

    private func submitSoreness() {
        guard !isSubmitting else { return }
        let cleanNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanNotes.count <= 500 else {
            notice = "Notes must be 500 characters or fewer."
            return
        }
        notice = ""
        isSubmitting = true
        Task {
            do {
                try await session.logSoreness(level: selectedLevel, notes: cleanNotes.isEmpty ? nil : cleanNotes)
                notice = "Today's soreness is saved."
                notes = ""
            } catch {
                notice = error.localizedDescription
            }
            isSubmitting = false
        }
    }

    private func syncSelection() {
        if let level = session.injuryRisk?.sorenessLevel, ["LOW", "MEDIUM", "HIGH"].contains(level.uppercased()) {
            selectedLevel = level.uppercased()
        }
    }

    private func display(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func riskColor(_ value: String?) -> Color {
        switch value?.uppercased() {
        case "HIGH": return HermesTheme.coral
        case "MEDIUM", "MODERATE": return Color.orange
        default: return HermesTheme.mintInk
        }
    }
}

private struct SorenessChoice: View {
    let title: String
    let isSelected: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(HermesTheme.caption)
                .foregroundStyle(isSelected ? .white : color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(isSelected ? color : color.opacity(0.12), in: Capsule())
        }
        .accessibilityLabel("Soreness \(title)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct WellnessView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { WellnessView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
