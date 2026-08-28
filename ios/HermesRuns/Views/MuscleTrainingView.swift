import Foundation
import SwiftUI

struct MuscleTrainingView: View {
    @ObservedObject var session: SessionStore

    @State private var runType = "EASY"
    @State private var entryState = "ACTUAL"
    @State private var distanceKm = ""
    @State private var durationMinutes = ""
    @State private var strengthFocus = ""
    @State private var strengthDose = ""
    @State private var experienceLevel = "BEGINNER"
    @State private var equipmentLevel = "BODYWEIGHT"
    @State private var sessionMinutes = 30
    @State private var noisePreference = "NORMAL"
    @State private var preferredDays: Set<String> = ["TUESDAY", "THURSDAY"]
    @State private var isSaving = false
    @State private var notice = ""

    private let runTypes = ["REST", "EASY", "RECOVERY", "QUALITY", "LONG_RUN", "CROSS_TRAIN"]
    private let entryStates = ["PLANNED", "ACTUAL"]
    private let experienceLevels = ["BEGINNER", "INTERMEDIATE", "CONSISTENT"]
    private let equipmentLevels = ["BODYWEIGHT", "BAND", "DUMBBELL", "GYM"]
    private let noisePreferences = ["NORMAL", "QUIET_ONLY"]
    private let dayOptions = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Muscle training")
                Text("Build strength around the run.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if session.muscleLoading && session.musclePlan == nil {
                    ProgressView()
                        .tint(HermesTheme.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else if let plan = session.musclePlan {
                    planContent(plan)
                } else {
                    HermesCard(fill: HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("MUSCLE PLAN UNAVAILABLE")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(HermesTheme.coralSoft)
                            Text(session.muscleErrorMessage ?? "Sign in to load the strength plan generated from your running context.")
                                .font(HermesTheme.body)
                                .foregroundStyle(.white.opacity(0.78))
                                .fixedSize(horizontal: false, vertical: true)
                            Button("Try again") { Task { await session.refreshMuscleTraining() } }
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
        .navigationTitle("Strength")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await session.refreshMuscleTraining() }
        .task {
            if session.musclePlan == nil { await session.refreshMuscleTraining() }
            syncLoadedState()
        }
        .onChange(of: session.musclePlan?.todayCheckIn?.trainingDate) { _ in syncCheckIn() }
        .onChange(of: session.muscleProfile?.sessionMinutes) { _ in syncProfile() }
    }

    @ViewBuilder
    private func planContent(_ plan: HermesMusclePlan) -> some View {
        if let context = plan.weekContext {
            HermesCard(fill: HermesTheme.ink) {
                VStack(alignment: .leading, spacing: 16) {
                    Text("WEEK CONTEXT")
                        .font(HermesTheme.section)
                        .tracking(1)
                        .foregroundStyle(HermesTheme.coralSoft)
                    Text(display(plan.recommendedMuscleArea ?? context.currentFocus ?? "Balanced strength"))
                        .font(HermesTheme.title)
                        .foregroundStyle(.white)
                    Text(context.recoveryGate?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Strength follows the run load.")
                        .font(HermesTheme.body)
                        .foregroundStyle(.white.opacity(0.72))
                    HStack(spacing: 0) {
                        HermesMetric(value: HermesFormatters.distance(context.volumeKm7d), label: "7-day run load", valueColor: .white, labelColor: .white.opacity(0.62))
                        HermesMetric(value: "\(context.recommendedSessionsPerWeek ?? 0)", label: "sessions", valueColor: .white, labelColor: .white.opacity(0.62))
                        HermesMetric(value: display(context.loadStatus ?? "—"), label: "load", valueColor: .white, labelColor: .white.opacity(0.62))
                    }
                }
            }
        }

        checkInCard(plan.todayCheckIn)

        HermesSectionLabel(text: "Seven-day plan")
        ForEach(Array((plan.days ?? []).enumerated()), id: \.offset) { _, day in
            MuscleDayRow(day: day)
        }

        if let sessions = plan.sessions, !sessions.isEmpty {
            HermesSectionLabel(text: "Session library")
            ForEach(Array(sessions.enumerated()), id: \.offset) { _, sessionDefinition in
                MuscleSessionCard(session: sessionDefinition)
            }
        }

        profileCard

        if !notice.isEmpty {
            Text(notice)
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.mintInk)
        }
        if let error = session.muscleErrorMessage, !error.isEmpty {
            Text(error)
                .font(HermesTheme.caption)
                .foregroundStyle(HermesTheme.coral)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func checkInCard(_ checkIn: HermesTodayCheckIn?) -> some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    HermesSectionLabel(text: "Today's check-in")
                    Spacer()
                    if checkIn != nil {
                        Text("Saved")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                    }
                }
                Picker("Run type", selection: $runType) {
                    ForEach(runTypes, id: \.self) { value in Text(display(value)).tag(value) }
                }
                .pickerStyle(.menu)
                Picker("Entry", selection: $entryState) {
                    ForEach(entryStates, id: \.self) { value in Text(display(value)).tag(value) }
                }
                .pickerStyle(.menu)
                HStack {
                    TextField("Distance km", text: $distanceKm)
                        .keyboardType(.decimalPad)
                    TextField("Minutes", text: $durationMinutes)
                        .keyboardType(.numberPad)
                }
                TextField("Strength focus (optional)", text: $strengthFocus)
                TextField("Strength dose (optional)", text: $strengthDose)
                Button {
                    saveCheckIn()
                } label: {
                    HStack {
                        if isSaving { ProgressView().tint(.white) }
                        Text(isSaving ? "Saving…" : "Save today's context")
                    }
                }
                .buttonStyle(HermesPrimaryButtonStyle())
                .disabled(isSaving)
                if checkIn != nil {
                    Button("Clear today's check-in", role: .destructive) {
                        clearCheckIn()
                    }
                    .font(HermesTheme.caption)
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private var profileCard: some View {
        HermesCard {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Experience", selection: $experienceLevel) {
                        ForEach(experienceLevels, id: \.self) { value in Text(display(value)).tag(value) }
                    }
                    .pickerStyle(.menu)
                    Picker("Equipment", selection: $equipmentLevel) {
                        ForEach(equipmentLevels, id: \.self) { value in Text(display(value)).tag(value) }
                    }
                    .pickerStyle(.menu)
                    Picker("Noise", selection: $noisePreference) {
                        ForEach(noisePreferences, id: \.self) { value in Text(display(value)).tag(value) }
                    }
                    .pickerStyle(.menu)
                    Stepper("Session length: \(sessionMinutes) min", value: $sessionMinutes, in: 10...120, step: 5)
                    Text("Preferred days")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], spacing: 8) {
                        ForEach(dayOptions, id: \.self) { day in
                            Button {
                                if preferredDays.contains(day) {
                                    if preferredDays.count > 1 { preferredDays.remove(day) }
                                } else {
                                    preferredDays.insert(day)
                                }
                            } label: {
                                Text(String(day.prefix(3)))
                                    .font(HermesTheme.caption)
                                    .foregroundStyle(preferredDays.contains(day) ? HermesTheme.ink : HermesTheme.mutedInk)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(preferredDays.contains(day) ? HermesTheme.coralSoft : HermesTheme.paper, in: Capsule())
                            }
                        }
                    }
                    Button("Save training profile") { saveProfile() }
                        .buttonStyle(HermesPrimaryButtonStyle())
                        .disabled(isSaving)
                }
                .padding(.top, 12)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HermesSectionLabel(text: "Training profile")
                    Text("Tune the strength plan to your equipment and week.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }
            }
        }
    }

    private func saveCheckIn() {
        guard !isSaving else { return }
        let cleanDistance = distanceKm.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDuration = durationMinutes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanDistance.isEmpty || (Double(cleanDistance).map { $0 >= 0 } == true) else {
            notice = "Distance must be zero or greater."
            return
        }
        guard cleanDuration.isEmpty || (Int(cleanDuration).map { $0 >= 0 } == true) else {
            notice = "Minutes must be zero or greater."
            return
        }
        notice = ""
        isSaving = true
        let draft = HermesMuscleCheckInDraft(
            runType: runType,
            entryState: entryState,
            distanceKm: cleanDistance.isEmpty ? nil : Double(cleanDistance),
            durationMinutes: cleanDuration.isEmpty ? nil : Int(cleanDuration),
            strengthFocus: optionalText(strengthFocus),
            strengthDose: optionalText(strengthDose)
        )
        Task {
            do {
                try await session.updateMuscleCheckIn(draft)
                notice = "Today's training context is saved."
            } catch {
                notice = error.localizedDescription
            }
            isSaving = false
        }
    }

    private func clearCheckIn() {
        guard !isSaving else { return }
        isSaving = true
        Task {
            do {
                try await session.clearMuscleCheckIn()
                notice = "Today's check-in was cleared."
            } catch {
                notice = error.localizedDescription
            }
            isSaving = false
        }
    }

    private func saveProfile() {
        guard !isSaving else { return }
        isSaving = true
        let draft = HermesMuscleProfileDraft(
            experienceLevel: experienceLevel,
            equipmentLevel: equipmentLevel,
            sessionMinutes: sessionMinutes,
            noisePreference: noisePreference,
            preferredStrengthDays: dayOptions.filter { preferredDays.contains($0) }
        )
        Task {
            do {
                try await session.updateMuscleProfile(draft)
                notice = "Training profile updated."
            } catch {
                notice = error.localizedDescription
            }
            isSaving = false
        }
    }

    private func syncLoadedState() {
        syncProfile()
        syncCheckIn()
    }

    private func syncProfile() {
        guard let profile = session.muscleProfile else { return }
        experienceLevel = profile.experienceLevel ?? experienceLevel
        equipmentLevel = profile.equipmentLevel ?? equipmentLevel
        sessionMinutes = profile.sessionMinutes ?? sessionMinutes
        noisePreference = profile.noisePreference ?? noisePreference
        if let days = profile.preferredStrengthDays, !days.isEmpty { preferredDays = Set(days) }
    }

    private func syncCheckIn() {
        guard let checkIn = session.musclePlan?.todayCheckIn else { return }
        runType = checkIn.runType ?? runType
        entryState = checkIn.entryState ?? entryState
        distanceKm = checkIn.distanceKm.map { String(format: "%.1f", $0) } ?? ""
        durationMinutes = checkIn.durationMinutes.map(String.init) ?? ""
        strengthFocus = checkIn.strengthFocus ?? ""
        strengthDose = checkIn.strengthDose ?? ""
    }

    private func optionalText(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func display(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

private struct MuscleDayRow: View {
    let day: HermesMuscleDay

    var body: some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.dayLabel?.capitalized ?? HermesFormatters.date(HermesDate.parse(day.date)))
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                        Text(display(day.run?.workoutType ?? "Rest"))
                            .font(HermesTheme.title)
                            .foregroundStyle(HermesTheme.ink)
                    }
                    Spacer()
                    if let strength = day.strength {
                        Text(display(strength.title ?? "Strength"))
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                            .multilineTextAlignment(.trailing)
                    }
                }
                HStack(spacing: 0) {
                    HermesMetric(value: HermesFormatters.distance(day.run?.plannedDistanceKm), label: "run")
                    HermesMetric(value: HermesFormatters.plannedTime(minutes: day.run?.plannedDurationMinutes), label: "time")
                    HermesMetric(value: day.strength.map { "\($0.durationMinutes ?? 0) min" } ?? "—", label: "strength")
                }
                if let caution = day.strength?.cautionCode, !caution.isEmpty {
                    Text("Caution: \(display(caution))")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                } else if let reason = day.noStrengthReasonCode, !reason.isEmpty {
                    Text(display(reason))
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }
            }
        }
    }

    private func display(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

private struct MuscleSessionCard: View {
    let session: HermesMuscleSession

    var body: some View {
        HermesCard {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array((session.blocks ?? []).enumerated()), id: \.offset) { _, block in
                        Text(block.title ?? "Block")
                            .font(HermesTheme.section)
                            .foregroundStyle(HermesTheme.coral)
                        ForEach(Array((block.exercises ?? []).enumerated()), id: \.offset) { _, exercise in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(exercise.name ?? "Exercise")
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundStyle(HermesTheme.ink)
                                Text("\(exercise.sets ?? 0) sets · \(exercise.repsOrDuration ?? "self-paced")")
                                    .font(HermesTheme.caption)
                                    .foregroundStyle(HermesTheme.mutedInk)
                            }
                        }
                    }
                }
                .padding(.top, 12)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.title ?? "Strength session")
                        .font(HermesTheme.title)
                        .foregroundStyle(HermesTheme.ink)
                    Text("\(session.durationMinutes ?? 0) min · RPE \(session.targetRpe ?? 0) · \(session.emphasis ?? "runner resilience")")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }
            }
        }
    }
}

struct MuscleTrainingView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { MuscleTrainingView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
