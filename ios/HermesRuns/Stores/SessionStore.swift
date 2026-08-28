import Foundation
import Combine

enum HermesSessionPhase: Equatable {
    case restoring
    case signedOut
    case loading
    case ready
    case failed
}

@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var phase: HermesSessionPhase = .restoring
    @Published private(set) var dashboard: HermesTodayDashboard?
    @Published private(set) var analysisRuns: [HermesRun] = []
    @Published private(set) var schedule: [HermesScheduledWorkout] = []
    @Published private(set) var muscleProfile: HermesMuscleProfile?
    @Published private(set) var musclePlan: HermesMusclePlan?
    @Published private(set) var muscleLoading = false
    @Published private(set) var muscleErrorMessage: String?
    @Published private(set) var injuryRisk: HermesInjuryRiskAssessment?
    @Published private(set) var injuryRiskLoading = false
    @Published private(set) var injuryRiskErrorMessage: String?
    @Published private(set) var stravaStatus: HermesStravaStatus?
    @Published private(set) var stravaLoading = false
    @Published private(set) var stravaErrorMessage: String?
    @Published private(set) var profilePreferences: HermesProfilePreferences?
    @Published private(set) var profileSettingsLoading = false
    @Published private(set) var profileSettingsErrorMessage: String?
    @Published private(set) var email: String?
    @Published private(set) var errorMessage: String?
    @Published var apiBaseURL: String

    private let keychain: KeychainStore
    private var apiClient: HermesAPIClient
    private var token: String?

    private let tokenAccount = "session-token"
    private let emailAccount = "session-email"

    init(keychain: KeychainStore = KeychainStore(), previewDashboard: HermesTodayDashboard? = nil) {
        self.keychain = keychain
        self.apiClient = HermesAPIClient(baseURL: HermesAPIClient.defaultBaseURL())
        self.apiBaseURL = self.apiClient.baseURL.absoluteString
        self.dashboard = previewDashboard
        if previewDashboard != nil { self.phase = .ready }
    }

    var isAuthenticated: Bool { token != nil }

    func restore() async {
        token = keychain.read(account: tokenAccount)
        email = keychain.read(account: emailAccount)
        guard token != nil else {
            phase = .signedOut
            return
        }
        await refreshDashboard()
    }

    func login(email: String, password: String) async {
        errorMessage = nil
        phase = .loading
        do {
            let response = try await apiClient.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            token = response.token
            self.email = response.email
            try keychain.save(response.token, account: tokenAccount)
            try keychain.save(response.email, account: emailAccount)
            await refreshDashboard()
        } catch {
            phase = .failed
            errorMessage = error.localizedDescription
        }
    }

    func requestPasswordReset(email: String) async throws {
        try await apiClient.requestPasswordReset(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    func refreshProfileSettings() async {
        guard let token else {
            profileSettingsErrorMessage = HermesAPIError.unauthorized.localizedDescription
            return
        }
        profileSettingsLoading = true
        profileSettingsErrorMessage = nil
        do {
            profilePreferences = try await apiClient.fetchProfilePreferences(token: token)
        } catch HermesAPIError.unauthorized {
            clearSession()
            phase = .signedOut
            profileSettingsErrorMessage = HermesAPIError.unauthorized.localizedDescription
        } catch {
            profileSettingsErrorMessage = error.localizedDescription
        }
        profileSettingsLoading = false
    }

    func updateDisplayName(_ displayName: String) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        let updatedProfile = try await apiClient.updateDisplayName(token: token, displayName: displayName)
        guard let dashboard else { return }
        self.dashboard = HermesTodayDashboard(
            profile: updatedProfile,
            activities: dashboard.activities,
            coachToday: dashboard.coachToday,
            weather: dashboard.weather,
            races: dashboard.races,
            shoes: dashboard.shoes
        )
    }

    func updateProfilePreferences(_ draft: HermesProfilePreferencesDraft) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        profilePreferences = try await apiClient.updateProfilePreferences(token: token, draft: draft)
    }

    func importActivityFiles(_ uploads: [HermesImportUpload]) async throws -> HermesImportResult {
        guard let token else { throw HermesAPIError.unauthorized }
        let result = try await apiClient.importActivityFiles(token: token, uploads: uploads)
        await refreshDashboard()
        return result
    }

    func saveShoe(_ draft: HermesShoeDraft, id: Int64? = nil) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        if let id {
            _ = try await apiClient.updateShoe(token: token, id: id, draft: draft)
        } else {
            _ = try await apiClient.createShoe(token: token, draft: draft)
        }
        await refreshDashboard()
    }

    func retireShoe(id: Int64) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        try await apiClient.retireShoe(token: token, id: id)
        await refreshDashboard()
    }

    func saveRace(_ draft: HermesRaceDraft, id: Int64? = nil) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        if let id {
            _ = try await apiClient.updateRace(token: token, id: id, draft: draft)
        } else {
            _ = try await apiClient.createRace(token: token, draft: draft)
        }
        await refreshDashboard()
    }

    func deleteRace(id: Int64) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        try await apiClient.deleteRace(token: token, id: id)
        await refreshDashboard()
    }

    func fetchRaceCourseMap(race: HermesRace) async throws -> HermesRaceCourseMap {
        guard let token else { throw HermesAPIError.unauthorized }
        return try await apiClient.fetchRaceCourseMap(token: token, race: race)
    }

    func refreshMuscleTraining() async {
        guard let token else {
            muscleErrorMessage = HermesAPIError.unauthorized.localizedDescription
            return
        }
        muscleLoading = true
        muscleErrorMessage = nil
        do {
            muscleProfile = try await apiClient.fetchMuscleProfile(token: token)
            musclePlan = try await apiClient.fetchMusclePlan(token: token)
        } catch HermesAPIError.unauthorized {
            clearSession()
            phase = .signedOut
            muscleErrorMessage = HermesAPIError.unauthorized.localizedDescription
        } catch {
            muscleErrorMessage = error.localizedDescription
        }
        muscleLoading = false
    }

    func updateMuscleProfile(_ draft: HermesMuscleProfileDraft) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        muscleProfile = try await apiClient.updateMuscleProfile(token: token, draft: draft)
        await refreshMuscleTraining()
    }

    func updateMuscleCheckIn(_ draft: HermesMuscleCheckInDraft) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        _ = try await apiClient.updateMuscleCheckIn(token: token, draft: draft)
        await refreshMuscleTraining()
    }

    func clearMuscleCheckIn() async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        try await apiClient.clearMuscleCheckIn(token: token)
        await refreshMuscleTraining()
    }

    func refreshInjuryRisk() async {
        guard let token else {
            injuryRiskErrorMessage = HermesAPIError.unauthorized.localizedDescription
            return
        }
        injuryRiskLoading = true
        injuryRiskErrorMessage = nil
        do {
            injuryRisk = try await apiClient.fetchInjuryRisk(token: token)
        } catch HermesAPIError.unauthorized {
            clearSession()
            phase = .signedOut
            injuryRiskErrorMessage = HermesAPIError.unauthorized.localizedDescription
        } catch {
            injuryRiskErrorMessage = error.localizedDescription
        }
        injuryRiskLoading = false
    }

    func logSoreness(level: String, notes: String?) async throws {
        guard let token else { throw HermesAPIError.unauthorized }
        try await apiClient.logSoreness(token: token, draft: HermesSorenessDraft(level: level, notes: notes))
        await refreshInjuryRisk()
    }

    func refreshStravaStatus() async {
        guard let token else {
            stravaErrorMessage = HermesAPIError.unauthorized.localizedDescription
            return
        }
        stravaLoading = true
        stravaErrorMessage = nil
        do {
            stravaStatus = try await apiClient.fetchStravaStatus(token: token)
        } catch HermesAPIError.unauthorized {
            clearSession()
            phase = .signedOut
            stravaErrorMessage = HermesAPIError.unauthorized.localizedDescription
        } catch {
            stravaErrorMessage = error.localizedDescription
        }
        stravaLoading = false
    }

    func requestStravaLinkURL() async throws -> URL {
        guard let token else { throw HermesAPIError.unauthorized }
        return try await apiClient.requestStravaLinkURL(token: token)
    }

    func startStravaSync() async throws -> String {
        guard let token else { throw HermesAPIError.unauthorized }
        let message = try await apiClient.startStravaSync(token: token)
        await refreshStravaStatus()
        return message
    }

    func refreshStravaSyncStatus() async throws -> HermesStravaSyncStatus {
        guard let token else { throw HermesAPIError.unauthorized }
        let status = try await apiClient.fetchStravaSyncStatus(token: token)
        if let current = stravaStatus {
            stravaStatus = HermesStravaStatus(linked: current.linked, configured: current.configured, mode: current.mode, syncStatus: status)
        }
        return status
    }

    func fetchRunAnalytics(id: Int64) async throws -> HermesRunAnalytics {
        guard let token else { throw HermesAPIError.unauthorized }
        return try await apiClient.fetchRunAnalytics(token: token, id: id)
    }

    func fetchRunTelemetry(id: Int64) async throws -> HermesRunTelemetry {
        guard let token else { throw HermesAPIError.unauthorized }
        return try await apiClient.fetchRunTelemetry(token: token, id: id)
    }

    func fetchRunRoute(id: Int64) async throws -> [HermesRoutePoint] {
        guard let token else { throw HermesAPIError.unauthorized }
        return try await apiClient.fetchRunRoute(token: token, id: id)
    }

    func refreshDashboard() async {
        guard let token else {
            phase = .signedOut
            return
        }
        phase = .loading
        errorMessage = nil
        do {
            dashboard = try await apiClient.fetchTodayDashboard(token: token)
            if let fetchedAnalysis = try? await apiClient.fetchAnalysis(token: token) {
                analysisRuns = fetchedAnalysis
            }
            if let fetchedSchedule = try? await apiClient.fetchSchedule(token: token) {
                schedule = fetchedSchedule
            }
            phase = .ready
        } catch HermesAPIError.unauthorized {
            clearSession()
            phase = .signedOut
            errorMessage = HermesAPIError.unauthorized.localizedDescription
        } catch {
            phase = .failed
            errorMessage = error.localizedDescription
        }
    }

    @discardableResult
    func updateAPIBaseURL(_ value: String) -> Bool {
        do {
            try apiClient.updateBaseURL(value)
            apiBaseURL = apiClient.baseURL.absoluteString
            UserDefaults.standard.set(apiBaseURL, forKey: "hermes.api.baseURL")
            dashboard = nil
            analysisRuns = []
            schedule = []
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func logout() async {
        if let token { await apiClient.logout(token: token) }
        clearSession()
        phase = .signedOut
    }

    private func clearSession() {
        keychain.delete(account: tokenAccount)
        keychain.delete(account: emailAccount)
        token = nil
        email = nil
        dashboard = nil
        analysisRuns = []
        schedule = []
        muscleProfile = nil
        musclePlan = nil
        muscleLoading = false
        muscleErrorMessage = nil
        injuryRisk = nil
        injuryRiskLoading = false
        injuryRiskErrorMessage = nil
        stravaStatus = nil
        stravaLoading = false
        stravaErrorMessage = nil
        profilePreferences = nil
        profileSettingsLoading = false
        profileSettingsErrorMessage = nil
    }
}
