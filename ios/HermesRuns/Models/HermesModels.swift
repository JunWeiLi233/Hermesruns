import Foundation

struct HermesAuthResponse: Decodable {
    let token: String
    let email: String
    let role: String?
}

struct HermesProfile: Decodable {
    let email: String?
    let displayName: String?
    let avatarUrl: String?
    let stravaLinked: Bool?
    let showLanguageSettingsHint: Bool?
}

struct HermesProfilePreferences: Codable {
    let mantra: String?
    let weeklyDigestEnabled: Bool?
}

struct HermesDisplayNameDraft: Encodable {
    let displayName: String
}

struct HermesProfilePreferencesDraft: Encodable {
    let mantra: String
    let weeklyDigestEnabled: Bool
}

enum HermesImportProvider: String, CaseIterable, Identifiable, Hashable {
    case exports
    case coros
    case huawei

    var id: String { rawValue }

    var title: String {
        switch self {
        case .exports: return "FIT / GPX"
        case .coros: return "COROS"
        case .huawei: return "HUAWEI"
        }
    }
}

struct HermesImportUpload {
    let provider: HermesImportProvider
    let filename: String
    let data: Data
}

struct HermesImportResult: Decodable {
    let provider: String?
    let importedActivities: Int?
    let importedPoints: Int?
    let skippedDuplicates: Int?
    let skippedNonRuns: Int?
    let message: String?
    let rejectedFiles: [String]?
}

struct HermesTodayDashboard: Decodable {
    let profile: HermesProfile?
    let activities: [HermesRun]
    let coachToday: HermesCoachToday?
    let weather: HermesWeatherContext?
    let races: [HermesRace]
    let shoes: [HermesShoe]

    init(
        profile: HermesProfile? = nil,
        activities: [HermesRun] = [],
        coachToday: HermesCoachToday? = nil,
        weather: HermesWeatherContext? = nil,
        races: [HermesRace] = [],
        shoes: [HermesShoe] = []
    ) {
        self.profile = profile
        self.activities = activities
        self.coachToday = coachToday
        self.weather = weather
        self.races = races
        self.shoes = shoes
    }
}

struct HermesCoachToday: Decodable {
    let today: HermesScheduledWorkout?
    let state: HermesCoachState?
    let routeRecommendation: HermesRouteRecommendation?
    let recommendedShoe: HermesRecommendedShoe?
    let runnerState: String?
    let coachMessage: String?
    let plan: HermesCoachPlan?
}

struct HermesScheduledWorkout: Decodable {
    let scheduledDate: String?
    let workoutType: String?
    let plannedDistanceKm: Double?
    let plannedDurationMinutes: Int?
    let stridesSuggested: Bool?
    let notes: String?
    let mutatedFrom: String?
    let readinessAdjusted: Bool?
    let phase: String?
    let intent: String?
    let reasonCode: String?
    let targetPaceMinSecondsPerKm: Int?
    let targetPaceMaxSecondsPerKm: Int?
}

struct HermesCoachState: Decodable {
    let volumeKm7d: Double?
    let volumeKm28d: Double?
    let minutesLowZ1Z2Last7d: Int?
    let minutesGreyZ3Last7d: Int?
    let minutesHighZ4Z5Last7d: Int?
    let minutesUnknownHrLast7d: Int?
    let highIntensityRatioLast7d: Double?
    let highMileageGrinder: Bool?
    let baselineRestingHr: Int?
    let lastNightRestingHr: Int?
    let lastSleepScore: Int?
    let lastHrvMs: Int?
    let lastStressScore: Int?
    let lastHrvStatus: String?
    let lastBodyBatteryAtWake: Int?
    let readinessScore: Int?
    let readinessVerdict: String?
    let readinessSleep: Int?
    let readinessHrv: Int?
    let readinessRhr: Int?
    let readinessStress: Int?
    let currentReadinessScore: Int?
    let readinessDataSupported: Bool?
    let sleepDataSupported: Bool?
    let sleepDataSource: String?
    let profileMaxHeartRateBpm: Int?
    let profileRestingHeartRateBpm: Int?
    let stamina: HermesStamina?
    let activeBlock: HermesTrainingBlock?
}

struct HermesStamina: Decodable {
    let scorePercent: Int?
    let recoveryCapPercent: Int?
    let targetPaceSecondsPerKm: Int?
    let targetHeartRateBpm: Int?
    let direction: String?
}

struct HermesTrainingBlock: Decodable {
    let raceDistanceKm: Double?
    let targetRaceDate: String?
    let weekIndex: Int?
    let currentLongRunKm: Double?
    let name: String?
}

struct HermesCoachPlan: Decodable {
    let phase: String?
    let targetWeeklyKm: Double?
    let sessionsPerWeek: Int?
    let preferredRunDays: [String]?
    let confidence: Int?
    let reasonCodes: [String]?
}

struct HermesRouteRecommendation: Decodable {
    let title: String?
    let reason: String?
    let distanceKm: Double?
}

struct HermesRecommendedShoe: Decodable {
    let id: Int64?
    let brand: String?
    let model: String?
    let nickname: String?
    let photoUrl: String?
    let currentDistanceKm: Double?
    let maxDistanceKm: Double?
    let type: String?
    let surfaceType: String?
    let lastWornAt: String?
    let daysSinceLastWear: Int?
    let recommendationReason: String?
}

struct HermesRun: Decodable {
    let id: Int64?
    let name: String?
    let distanceKm: Double?
    let distanceMeters: Double?
    let movingTimeSeconds: Double?
    let durationSeconds: Double?
    let startDate: String?
    let startTime: String?
    let createdAt: String?
    let averageHeartRate: Double?
    let totalElevationGain: Double?
    let averageCadence: Double?
    let provider: String?
    let shoeName: String?

    var displayDate: Date? {
        HermesDate.parse(startTime ?? startDate ?? createdAt)
    }

    var resolvedDistanceKm: Double {
        if let distanceKm, distanceKm > 0 { return distanceKm }
        return max(0, (distanceMeters ?? 0) / 1000)
    }

    var resolvedDurationSeconds: Double {
        movingTimeSeconds ?? durationSeconds ?? 0
    }
}

struct HermesShoe: Decodable {
    let id: Int64?
    let brand: String?
    let model: String?
    let nickname: String?
    let photoUrl: String?
    let currentDistanceKm: Double?
    let maxDistanceKm: Double?
    let type: String?
    let surfaceType: String?
    let isPrimary: Bool?
    let retired: Bool?
    let lastWornAt: String?
    let daysSinceLastWear: Int?

    var displayName: String {
        let parts = [brand, model].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: " ") }
        return nickname?.isEmpty == false ? nickname! : "Unnamed shoe"
    }

    var healthPercent: Double {
        guard let maxDistanceKm, maxDistanceKm > 0 else { return 0 }
        return min(1, max(0, (currentDistanceKm ?? 0) / maxDistanceKm))
    }
}

struct HermesShoeDraft: Encodable {
    let brand: String
    let model: String
    let nickname: String?
    let maxDistanceKm: Double?
    let initialDistanceKm: Double?
    let isPrimary: Bool
}

struct HermesRace: Decodable {
    let id: Int64?
    let name: String?
    let organization: String?
    let eventDate: String?
    let location: String?
    let distanceKm: Double?
    let registrationStatus: String?
    let goalTimeSeconds: Int?
    let notes: String?
    let nyrrNinePlusOneEligible: Bool?
    let completedActivityId: Int64?
    let completed: Bool?
    let countdownDays: Int?
    let canceled: Bool?
}

struct HermesRaceDraft: Encodable {
    let name: String
    let organization: String?
    let location: String?
    let eventDate: String
    let distanceKm: Double?
    let registrationStatus: String
    let goalTimeSeconds: Int?
    let notes: String?
    let nyrrNinePlusOneEligible: Bool
    let completedActivityId: Int64?
}

struct HermesMuscleProfile: Decodable {
    let experienceLevel: String?
    let equipmentLevel: String?
    let sessionMinutes: Int?
    let noisePreference: String?
    let preferredStrengthDays: [String]?
}

struct HermesMuscleProfileDraft: Encodable {
    let experienceLevel: String
    let equipmentLevel: String
    let sessionMinutes: Int
    let noisePreference: String
    let preferredStrengthDays: [String]
}

struct HermesMusclePlan: Decodable {
    let weekContext: HermesMuscleWeekContext?
    let days: [HermesMuscleDay]?
    let sessions: [HermesMuscleSession]?
    let rationale: [String]?
    let todayCheckIn: HermesTodayCheckIn?
    let planSource: String?
    let recommendedMuscleArea: String?
    let recommendedMuscleReasonCode: String?
}

struct HermesMuscleWeekContext: Decodable {
    let volumeKm7d: Double?
    let volumeKm28d: Double?
    let acwr: Double?
    let highIntensityRatioLast7d: Double?
    let loadStatus: String?
    let recoveryGate: String?
    let recommendedSessionsPerWeek: Int?
    let currentFocus: String?
    let conservativeMode: Bool?
    let raceWeek: Bool?
    let nextKeyRunDate: String?
    let nextKeyRunType: String?
    let nextLongRunDate: String?
    let nextLongRunKm: Double?
    let recentHardRunCount7d: Int?
}

struct HermesMuscleDay: Decodable {
    let date: String?
    let dayLabel: String?
    let run: HermesMuscleRun?
    let strength: HermesStrengthAssignment?
    let noStrengthReasonCode: String?
}

struct HermesMuscleRun: Decodable {
    let workoutType: String?
    let plannedDistanceKm: Double?
    let plannedDurationMinutes: Int?
    let keyRun: Bool?
    let longRun: Bool?
    let readinessAdjusted: Bool?
    let notes: String?
    let planSource: String?
}

struct HermesStrengthAssignment: Decodable {
    let sessionType: String?
    let title: String?
    let emphasis: String?
    let durationMinutes: Int?
    let targetRpe: Int?
    let optional: Bool?
    let quietCompatible: Bool?
    let placementReasonCode: String?
    let cautionCode: String?
}

struct HermesMuscleSession: Decodable {
    let sessionType: String?
    let title: String?
    let emphasis: String?
    let durationMinutes: Int?
    let targetRpe: Int?
    let optional: Bool?
    let blocks: [HermesMuscleBlock]?
}

struct HermesMuscleBlock: Decodable {
    let title: String?
    let exercises: [HermesExercise]?
}

struct HermesExercise: Decodable {
    let name: String?
    let sets: Int?
    let repsOrDuration: String?
    let targetRpe: Int?
    let tempoOrIntent: String?
    let noiseLevel: String?
    let equipmentNeeded: String?
    let regression: String?
    let progression: String?
}

struct HermesTodayCheckIn: Decodable {
    let trainingDate: String?
    let runType: String?
    let entryState: String?
    let distanceKm: Double?
    let durationMinutes: Int?
    let strengthFocus: String?
    let strengthDose: String?
    let updatedAt: String?
}

struct HermesMuscleCheckInDraft: Encodable {
    let runType: String
    let entryState: String
    let distanceKm: Double?
    let durationMinutes: Int?
    let strengthFocus: String?
    let strengthDose: String?
}

struct HermesSorenessLog: Decodable {
    let level: String?
    let date: String?
}

struct HermesInjuryRiskAssessment: Decodable {
    let acwr: Double?
    let sorenessLevel: String?
    let risk: String?
    let coachVoice: String?
    let combinedRiskScore: Int?
    let recommendation: String?
    let acwrTrend: String?
    let recentLogs: [HermesSorenessLog]?
    let coachAdvice: String?
}

struct HermesSorenessDraft: Encodable {
    let level: String
    let notes: String?
}

struct HermesRaceRoutePoint: Decodable {
    let lat: Double
    let lng: Double
    let label: String?
}

struct HermesRaceOverlayBounds: Decodable {
    let north: Double
    let south: Double
    let east: Double
    let west: Double
}

struct HermesRaceCourseMap: Decodable {
    let imageUrl: String?
    let previewImageUrl: String?
    let overlayImageUrl: String?
    let source: String?
    let routeAvailable: Bool?
    let cityLevelReference: Bool?
    let confidence: Int?
    let summary: String?
    let viewportBounds: HermesRaceOverlayBounds?
    let routePoints: [HermesRaceRoutePoint]?
    let routePointCount: Int?
    let elevationSamples: [Int]?
    let totalClimbMeters: Int?
    let aiAssisted: Bool?
    let officialRouteVerified: Bool?
}

struct HermesStravaStatus: Decodable {
    let linked: Bool?
    let configured: Bool?
    let mode: String?
    let syncStatus: HermesStravaSyncStatus?
}

struct HermesStravaSyncStatus: Decodable {
    let status: String?
    let importedRuns: Int?
    let skippedNonRuns: Int?
    let skippedDuplicates: Int?
    let processedActivities: Int?
    let processedPages: Int?
    let error: String?
    let active: Bool?
    let trigger: String?
    let recentOnly: Bool?
    let updatedAt: String?
}

struct HermesStravaLinkResponse: Decodable {
    let url: String?
}

struct HermesRunAnalytics: Decodable {
    let laps: [HermesRunLap]?
    let elevationProfile: [HermesElevationSample]?
    let averageCadence: Double?
    let averageStrideLengthMeters: Double?
    let cardiacDrift: HermesCardiacDrift?
    let minElevationMeters: Double?
    let maxElevationMeters: Double?
    let debrief: HermesPostRunDebrief?
}

struct HermesRunLap: Decodable {
    let lapIndex: Int?
    let distanceKm: Double?
    let durationSeconds: Int?
    let pace: String?
    let averageHeartRate: Int?
    let averageCadence: Int?
    let elevationGainMeters: Double?
}

struct HermesElevationSample: Decodable {
    let distanceKm: Double?
    let elevationMeters: Double?
}

struct HermesCardiacDrift: Decodable {
    let driftPercent: Double?
    let firstHalfAverageHeartRate: Double?
    let secondHalfAverageHeartRate: Double?
    let firstHalfPace: String?
    let secondHalfPace: String?
}

struct HermesPostRunDebrief: Decodable {
    let interpretation: String?
    let readinessScore: Int?
    let nextDayGuidance: String?
}

struct HermesRunTelemetry: Decodable {
    let sampleCount: Int?
    let resolution: String?
    let series: [String: HermesTelemetrySeries]?
    let trainingEffect: HermesTrainingEffect?
}

struct HermesTelemetrySeries: Decodable {
    let key: String?
    let unit: String?
    let available: Bool?
    let samples: [HermesTelemetrySample]?
}

struct HermesTelemetrySample: Decodable {
    let t: Int?
    let value: Double?
    let distanceKm: Double?
}

struct HermesTrainingEffect: Decodable {
    let available: Bool?
    let source: String?
    let basis: String?
    let aerobic: Double?
    let anaerobic: Double?
    let averageHeartRate: Double?
    let maxHeartRateBasis: Double?
    let highIntensityShare: Double?
}

struct HermesRoutePoint: Decodable {
    let latitude: Double
    let longitude: Double
}

struct HermesWeatherContext: Decodable {
    let available: Bool?
    let latitude: Double?
    let longitude: Double?
    let currentDewPointC: Double?
    let baselineDewPoint14dC: Double?
    let climateShockDeltaC: Double?
    let climateShockEvent: Bool?
    let climateShockThresholdC: Double?
    let pacePenaltySecPerKm: Int?
    let acclimatizationDay: Int?
    let penaltyFactor: Double?
    let acclimatizationStatus: String?
    let message: String?
}

struct HermesDashboardSnapshot {
    let payload: HermesTodayDashboard

    var profile: HermesProfile? { payload.profile }
    var coach: HermesCoachToday? { payload.coachToday }
    var workout: HermesScheduledWorkout? { coach?.today }
    var recentRuns: [HermesRun] {
        payload.activities.sorted { ($0.displayDate ?? .distantPast) > ($1.displayDate ?? .distantPast) }
    }
    var activeShoes: [HermesShoe] { payload.shoes.filter { $0.retired != true } }
    var recommendedShoe: HermesRecommendedShoe? { coach?.recommendedShoe }

    var displayName: String {
        let value = profile?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "Runner" : value
    }

    var readinessScore: Int {
        let raw = coach?.state?.currentReadinessScore
            ?? coach?.state?.readinessScore
            ?? coach?.state?.stamina?.scorePercent
            ?? 0
        return min(100, max(0, raw))
    }

    var readinessLabel: String {
        switch readinessScore {
        case 90...: return "Peak readiness"
        case 73..<90: return "Ready to build"
        case 56..<73: return "Build with control"
        default: return "Protect recovery"
        }
    }

    var workoutTitle: String {
        let raw = workout?.workoutType?.replacingOccurrences(of: "_", with: " ") ?? "Easy run"
        return raw.capitalized
    }

    var workoutDistanceKm: Double? {
        guard let value = workout?.plannedDistanceKm, value > 0 else { return nil }
        return value
    }

    var workoutDurationMinutes: Int? {
        guard let value = workout?.plannedDurationMinutes, value > 0 else { return nil }
        return value
    }

    var weeklyDistanceKm: Double {
        let start = Calendar.current.date(byAdding: .day, value: -6, to: Date()) ?? .distantPast
        return recentRuns
            .filter { ($0.displayDate ?? .distantPast) >= start }
            .reduce(0) { $0 + $1.resolvedDistanceKm }
    }
}

enum HermesDate {
    private static let fractional = ISO8601DateFormatter()
    private static let plain = ISO8601DateFormatter()

    static func parse(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        plain.formatOptions = [.withInternetDateTime]
        if let date = fractional.date(from: string) ?? plain.date(from: string) { return date }
        let dateOnly = DateFormatter()
        dateOnly.calendar = Calendar(identifier: .gregorian)
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: string)
    }
}

enum HermesFormatters {
    static func distance(_ value: Double?) -> String {
        guard let value, value > 0 else { return "—" }
        return String(format: "%.1f km", value)
    }

    static func duration(_ seconds: Double?) -> String {
        let total = max(0, Int(seconds ?? 0))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let remainder = total % 60
        if hours > 0 { return String(format: "%d:%02d:%02d", hours, minutes, remainder) }
        return String(format: "%d:%02d", minutes, remainder)
    }

    static func pace(distanceKm: Double?, seconds: Double?) -> String {
        guard let distanceKm, distanceKm > 0, let seconds, seconds > 0 else { return "—" }
        let pace = Int((seconds / distanceKm).rounded())
        return String(format: "%d:%02d /km", pace / 60, pace % 60)
    }

    static func date(_ date: Date?) -> String {
        guard let date else { return "—" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func plannedTime(minutes: Int?) -> String {
        guard let minutes, minutes > 0 else { return "—" }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours > 0 { return String(format: "%d:%02d", hours, remainder) }
        return "\(minutes) min"
    }
}

enum HermesPreviewFixtures {
    static let dashboard: HermesTodayDashboard = {
        let json = """
        {
          "profile": { "email": "runner@example.com", "displayName": "Alex" },
          "activities": [
            { "id": 101, "name": "Morning aerobic", "distanceKm": 8.4, "movingTimeSeconds": 2640, "startTime": "2026-08-26T11:15:00Z" },
            { "id": 100, "name": "Progression run", "distanceKm": 10.0, "movingTimeSeconds": 2940, "startTime": "2026-08-23T11:00:00Z" },
            { "id": 99, "name": "Easy miles", "distanceKm": 6.2, "movingTimeSeconds": 2100, "startTime": "2026-08-21T11:30:00Z" }
          ],
          "coachToday": {
            "today": {
              "scheduledDate": "2026-08-27",
              "workoutType": "EASY",
              "plannedDistanceKm": 7.5,
              "plannedDurationMinutes": 44,
              "notes": "Keep this conversational. Finish feeling like you could do one more mile.",
              "targetPaceMinSecondsPerKm": 330,
              "targetPaceMaxSecondsPerKm": 360
            },
            "state": {
              "currentReadinessScore": 84,
              "readinessVerdict": "GO",
              "lastSleepScore": 88,
              "volumeKm7d": 24.6,
              "stamina": { "scorePercent": 84, "recoveryCapPercent": 90, "direction": "steady" }
            },
            "recommendedShoe": {
              "brand": "ASICS",
              "model": "Novablast",
              "recommendationReason": "Best match for today's easy aerobic work"
            },
            "runnerState": "active",
            "coachMessage": "Your recent rhythm supports an aerobic session today. Keep the first half deliberately easy."
          },
          "races": [],
          "shoes": [
            { "id": 1, "brand": "ASICS", "model": "Novablast", "type": "daily", "currentDistanceKm": 182.4, "maxDistanceKm": 650, "isPrimary": true, "retired": false },
            { "id": 2, "brand": "Saucony", "model": "Endorphin Speed", "type": "speed", "currentDistanceKm": 94.0, "maxDistanceKm": 550, "isPrimary": false, "retired": false }
          ]
        }
        """
        return try! JSONDecoder().decode(HermesTodayDashboard.self, from: Data(json.utf8))
    }()
}
