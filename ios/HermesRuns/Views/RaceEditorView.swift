import Foundation
import SwiftUI

struct RaceEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: SessionStore
    let race: HermesRace?

    @State private var name: String
    @State private var organization: String
    @State private var location: String
    @State private var eventDate: Date
    @State private var distanceKm: String
    @State private var registrationStatus: String
    @State private var goalTimeSeconds: String
    @State private var notes: String
    @State private var nyrrEligible: Bool
    @State private var isSaving = false
    @State private var errorMessage = ""

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private let statusOptions = ["INTERESTED", "APPLIED", "REGISTERED", "WAITLIST", "COMPLETED"]

    init(session: SessionStore, race: HermesRace? = nil) {
        self.session = session
        self.race = race
        _name = State(initialValue: race?.name ?? "")
        _organization = State(initialValue: race?.organization ?? "")
        _location = State(initialValue: race?.location ?? "")
        _eventDate = State(initialValue: HermesDate.parse(race?.eventDate) ?? Date())
        _distanceKm = State(initialValue: race?.distanceKm.map { String(format: "%.1f", $0) } ?? "")
        _registrationStatus = State(initialValue: race?.registrationStatus ?? "INTERESTED")
        _goalTimeSeconds = State(initialValue: race?.goalTimeSeconds.map(String.init) ?? "")
        _notes = State(initialValue: race?.notes ?? "")
        _nyrrEligible = State(initialValue: race?.nyrrNinePlusOneEligible == true)
    }

    private var isEditing: Bool { race?.id != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Race name", text: $name)
                    TextField("Organization (optional)", text: $organization)
                    TextField("Location (optional)", text: $location)
                    DatePicker("Race date", selection: $eventDate, displayedComponents: .date)
                } header: {
                    HermesSectionLabel(text: "Event")
                        .textCase(nil)
                }

                Section {
                    TextField("Distance (km, optional)", text: $distanceKm)
                        .keyboardType(.decimalPad)
                    Picker("Registration", selection: $registrationStatus) {
                        ForEach(statusOptions, id: \.self) { status in
                            Text(status.capitalized).tag(status)
                        }
                    }
                    TextField("Goal time (seconds, optional)", text: $goalTimeSeconds)
                        .keyboardType(.numberPad)
                    Toggle("NYRR 9+1 eligible", isOn: $nyrrEligible)
                        .tint(HermesTheme.coral)
                } header: {
                    HermesSectionLabel(text: "Target")
                        .textCase(nil)
                }

                Section {
                    TextEditor(text: $notes)
                        .frame(minHeight: 90)
                } header: {
                    HermesSectionLabel(text: "Notes")
                        .textCase(nil)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.coral)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(HermesTheme.paper.ignoresSafeArea())
            .navigationTitle(isEditing ? "Edit race" : "Add race")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func save() {
        guard !isSaving else { return }
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else {
            errorMessage = "Race name is required."
            return
        }

        let distance: Double?
        if distanceKm.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            distance = nil
        } else if let parsed = Double(distanceKm), parsed > 0 {
            distance = parsed
        } else {
            errorMessage = "Distance must be a positive number."
            return
        }

        let goal: Int?
        if goalTimeSeconds.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            goal = nil
        } else if let parsed = Int(goalTimeSeconds), parsed > 0 {
            goal = parsed
        } else {
            errorMessage = "Goal time must be a positive number of seconds."
            return
        }

        errorMessage = ""
        isSaving = true
        let draft = HermesRaceDraft(
            name: cleanName,
            organization: optionalText(organization),
            location: optionalText(location),
            eventDate: Self.dateFormatter.string(from: eventDate),
            distanceKm: distance,
            registrationStatus: registrationStatus,
            goalTimeSeconds: goal,
            notes: optionalText(notes),
            nyrrNinePlusOneEligible: nyrrEligible,
            completedActivityId: race?.completedActivityId
        )
        Task {
            do {
                try await session.saveRace(draft, id: race?.id)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }

    private func optionalText(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct RaceEditorView_Previews: PreviewProvider {
    static var previews: some View {
        RaceEditorView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard))
    }
}
