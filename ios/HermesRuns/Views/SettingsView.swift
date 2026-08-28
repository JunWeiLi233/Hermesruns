import SwiftUI

struct SettingsView: View {
    @ObservedObject var session: SessionStore
    @State private var draftURL = ""
    @State private var savedMessage = ""
    @State private var displayName = ""
    @State private var mantra = ""
    @State private var weeklyDigestEnabled = false
    @State private var profileMessage = ""
    @State private var profileSaving = false

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(session.dashboard.map { HermesDashboardSnapshot(payload: $0).displayName } ?? "Runner")
                        .font(HermesTheme.title)
                        .foregroundStyle(HermesTheme.ink)
                    Text(session.email ?? "Signed in")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }
                .padding(.vertical, 8)
                .listRowBackground(HermesTheme.paperRaised)
            }

            Section {
                TextField("Display name", text: $displayName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                TextField("Training mantra (optional)", text: $mantra, axis: .vertical)
                    .lineLimit(2...4)
                Toggle("Weekly digest", isOn: $weeklyDigestEnabled)
                Button {
                    Task { await saveProfileSettings() }
                } label: {
                    HStack {
                        Text("Save profile settings")
                        Spacer()
                        if profileSaving { ProgressView().tint(HermesTheme.coral) }
                    }
                }
                .disabled(profileSaving || displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if !profileMessage.isEmpty {
                    Text(profileMessage)
                        .font(HermesTheme.caption)
                        .foregroundStyle(profileMessage == "Profile settings saved." ? HermesTheme.mintInk : HermesTheme.coral)
                }
            } header: {
                HermesSectionLabel(text: "Runner profile")
                    .textCase(nil)
            } footer: {
                Text("Display names are limited by the Hermes server. Keep your mantra free of sensitive information.")
            }

            Section {
                TextField("http://localhost:8080", text: $draftURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Button("Save server URL") {
                    session.updateAPIBaseURL(draftURL)
                    savedMessage = session.errorMessage == nil ? "Server URL saved." : (session.errorMessage ?? "Unable to save URL.")
                }
                .foregroundStyle(HermesTheme.coral)
                if !savedMessage.isEmpty {
                    Text(savedMessage)
                        .font(HermesTheme.caption)
                        .foregroundStyle(session.errorMessage == nil ? HermesTheme.mintInk : HermesTheme.coral)
                }
            } header: {
                HermesSectionLabel(text: "Connection")
                    .textCase(nil)
            } footer: {
                Text("Use an HTTPS deployment on a physical device. Local HTTP is enabled only for development on trusted networks.")
            }

            Section {
                Button(role: .destructive) {
                    Task { await session.logout() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }

            Section {
                LabeledContent("App", value: "Hermes iOS")
                LabeledContent("Data", value: "Existing Hermes API")
                LabeledContent("Minimum iOS", value: "16.0")
            } header: {
                HermesSectionLabel(text: "About")
                    .textCase(nil)
            }
        }
        .scrollContentBackground(.hidden)
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            draftURL = session.apiBaseURL
            syncProfileFields()
        }
        .task {
            await session.refreshProfileSettings()
            syncProfileFields()
        }
    }

    private func syncProfileFields() {
        if displayName.isEmpty {
            displayName = session.dashboard.map { HermesDashboardSnapshot(payload: $0).displayName } ?? ""
        }
        if let preferences = session.profilePreferences {
            mantra = preferences.mantra ?? ""
            weeklyDigestEnabled = preferences.weeklyDigestEnabled ?? false
        }
    }

    private func saveProfileSettings() async {
        let normalizedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedMantra = mantra.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedName.isEmpty else {
            profileMessage = "Enter a display name."
            return
        }
        guard normalizedName.count <= 60 else {
            profileMessage = "Display name must be 60 characters or fewer."
            return
        }
        guard normalizedMantra.count <= 180 else {
            profileMessage = "Training mantra must be 180 characters or fewer."
            return
        }

        profileSaving = true
        profileMessage = ""
        do {
            try await session.updateDisplayName(normalizedName)
            try await session.updateProfilePreferences(
                HermesProfilePreferencesDraft(mantra: normalizedMantra, weeklyDigestEnabled: weeklyDigestEnabled)
            )
            profileMessage = "Profile settings saved."
        } catch {
            profileMessage = error.localizedDescription
        }
        profileSaving = false
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { SettingsView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
