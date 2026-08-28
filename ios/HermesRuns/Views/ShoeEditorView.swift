import SwiftUI

struct ShoeEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var session: SessionStore
    let shoe: HermesShoe?

    @State private var brand: String
    @State private var model: String
    @State private var nickname: String
    @State private var maxDistanceKm: String
    @State private var initialDistanceKm: String
    @State private var isPrimary: Bool
    @State private var isSaving = false
    @State private var errorMessage = ""

    init(session: SessionStore, shoe: HermesShoe? = nil) {
        self.session = session
        self.shoe = shoe
        _brand = State(initialValue: shoe?.brand ?? "")
        _model = State(initialValue: shoe?.model ?? "")
        _nickname = State(initialValue: shoe?.nickname ?? "")
        _maxDistanceKm = State(initialValue: shoe?.maxDistanceKm.map { String(format: "%.0f", $0) } ?? "650")
        _initialDistanceKm = State(initialValue: "")
        _isPrimary = State(initialValue: shoe?.isPrimary == true)
    }

    private var isEditing: Bool { shoe?.id != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Brand", text: $brand)
                    TextField("Model", text: $model)
                    TextField("Nickname (optional)", text: $nickname)
                } header: {
                    HermesSectionLabel(text: "Identity")
                        .textCase(nil)
                }

                Section {
                    TextField("Maximum distance (km)", text: $maxDistanceKm)
                        .keyboardType(.decimalPad)
                    if !isEditing {
                        TextField("Already logged (km)", text: $initialDistanceKm)
                            .keyboardType(.decimalPad)
                    }
                    Toggle("Primary rotation pick", isOn: $isPrimary)
                        .tint(HermesTheme.coral)
                } header: {
                    HermesSectionLabel(text: "Rotation")
                        .textCase(nil)
                } footer: {
                    Text("Mileage from Hermes activities is calculated server-side. This form only sets the shoe's identity and baseline.")
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
            .navigationTitle(isEditing ? "Edit shoe" : "Add shoe")
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
        let cleanBrand = brand.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanModel = model.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanBrand.isEmpty, !cleanModel.isEmpty else {
            errorMessage = "Brand and model are required."
            return
        }
        guard let maxDistance = Double(maxDistanceKm), maxDistance >= 0 else {
            errorMessage = "Maximum distance must be a non-negative number."
            return
        }
        let initialDistance: Double?
        if initialDistanceKm.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            initialDistance = nil
        } else if let parsed = Double(initialDistanceKm), parsed >= 0 {
            initialDistance = parsed
        } else {
            errorMessage = "Already logged distance must be a non-negative number."
            return
        }

        errorMessage = ""
        isSaving = true
        let draft = HermesShoeDraft(
            brand: cleanBrand,
            model: cleanModel,
            nickname: nickname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : nickname.trimmingCharacters(in: .whitespacesAndNewlines),
            maxDistanceKm: maxDistance,
            initialDistanceKm: initialDistance,
            isPrimary: isPrimary
        )
        Task {
            do {
                try await session.saveShoe(draft, id: shoe?.id)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }
}

struct ShoeEditorView_Previews: PreviewProvider {
    static var previews: some View {
        ShoeEditorView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard))
    }
}
