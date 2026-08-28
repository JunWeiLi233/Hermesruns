import XCTest
@testable import HermesRuns

final class HermesRunsTests: XCTestCase {
    func testDurationFormatterKeepsHoursAndSeconds() {
        XCTAssertEqual(HermesFormatters.duration(3661), "1:01:01")
    }

    func testPaceFormatterUsesKilometresPerHourEquivalentPace() {
        XCTAssertEqual(HermesFormatters.pace(distanceKm: 10, seconds: 3000), "5:00 /km")
    }

    func testPlannedTimeFormatterHandlesMinutesAndHours() {
        XCTAssertEqual(HermesFormatters.plannedTime(minutes: 44), "44 min")
        XCTAssertEqual(HermesFormatters.plannedTime(minutes: 75), "1:15")
    }

    func testPreviewDashboardDecodesTheNativeRunnerSurface() {
        let dashboard = HermesPreviewFixtures.dashboard
        XCTAssertEqual(dashboard.activities.count, 3)
        XCTAssertEqual(dashboard.coachToday?.today?.plannedDistanceKm, 7.5)
        XCTAssertEqual(dashboard.shoes.count, 2)
        XCTAssertNotNil(HermesDate.parse("2026-08-27"))
    }

    func testProfilePreferencesDecodeForNativeSettings() throws {
        let data = #"{"mantra":"Stay patient.","weeklyDigestEnabled":true}"#.data(using: .utf8)!
        let preferences = try JSONDecoder().decode(HermesProfilePreferences.self, from: data)

        XCTAssertEqual(preferences.mantra, "Stay patient.")
        XCTAssertEqual(preferences.weeklyDigestEnabled, true)
    }

    func testImportResultDecodesBatchCountsAndRejections() throws {
        let data = #"{"provider":"IMPORT","importedActivities":3,"importedPoints":120,"skippedDuplicates":1,"skippedNonRuns":0,"message":"Batch import completed.","rejectedFiles":["bad.txt: Unsupported upload file type."]}"#.data(using: .utf8)!
        let result = try JSONDecoder().decode(HermesImportResult.self, from: data)

        XCTAssertEqual(result.importedActivities, 3)
        XCTAssertEqual(result.importedPoints, 120)
        XCTAssertEqual(result.rejectedFiles?.count, 1)
    }

    func testImportProvidersMatchBackendMultipartFieldNames() {
        XCTAssertEqual(HermesImportProvider.exports.rawValue, "exports")
        XCTAssertEqual(HermesImportProvider.coros.rawValue, "coros")
        XCTAssertEqual(HermesImportProvider.huawei.rawValue, "huawei")
    }

    func testRaceCourseMapDecodesVerifiedRouteAndElevation() throws {
        let data = #"{"routeAvailable":true,"confidence":91,"routePoints":[{"lat":40.7,"lng":-74.0,"label":"Start"},{"lat":40.71,"lng":-73.99,"label":"Finish"}],"elevationSamples":[4,8,6],"totalClimbMeters":12,"officialRouteVerified":true}"#.data(using: .utf8)!
        let courseMap = try JSONDecoder().decode(HermesRaceCourseMap.self, from: data)

        XCTAssertEqual(courseMap.routePoints?.count, 2)
        XCTAssertEqual(courseMap.routePoints?.first?.lat, 40.7)
        XCTAssertEqual(courseMap.confidence, 91)
        XCTAssertEqual(courseMap.totalClimbMeters, 12)
        XCTAssertEqual(courseMap.officialRouteVerified, true)
    }

    func testBaseURLNormalizationAddsDevelopmentScheme() {
        XCTAssertEqual(HermesAPIClient.normalizedURL("localhost:8080")?.absoluteString, "http://localhost:8080")
    }

    func testMusclePlanDecodesRunnerContextAndSessionLibrary() throws {
        let data = #"{"weekContext":{"volumeKm7d":28.5,"loadStatus":"STABLE","recommendedSessionsPerWeek":2},"days":[{"date":"2026-08-27","dayLabel":"Thursday","run":{"workoutType":"EASY","plannedDistanceKm":6.0},"strength":{"title":"Runner foundation","durationMinutes":25}}],"sessions":[{"title":"Runner foundation","durationMinutes":25,"blocks":[{"title":"Core","exercises":[{"name":"Dead bug","sets":3,"repsOrDuration":"8 / side"}]}]}],"todayCheckIn":{"runType":"EASY","entryState":"ACTUAL","distanceKm":5.5,"durationMinutes":30}}"#.data(using: .utf8)!
        let plan = try JSONDecoder().decode(HermesMusclePlan.self, from: data)

        XCTAssertEqual(plan.weekContext?.volumeKm7d, 28.5)
        XCTAssertEqual(plan.days?.first?.strength?.durationMinutes, 25)
        XCTAssertEqual(plan.sessions?.first?.blocks?.first?.exercises?.first?.name, "Dead bug")
        XCTAssertEqual(plan.todayCheckIn?.entryState, "ACTUAL")
    }

    func testInjuryRiskDecodesRiskAndRecentSoreness() throws {
        let data = #"{"acwr":1.24,"sorenessLevel":"MEDIUM","risk":"MODERATE","coachVoice":"Shift toward recovery today.","combinedRiskScore":33,"recommendation":"caution","acwrTrend":"flat","recentLogs":[{"level":"MEDIUM","date":"2026-08-27"}]}"#.data(using: .utf8)!
        let assessment = try JSONDecoder().decode(HermesInjuryRiskAssessment.self, from: data)

        XCTAssertEqual(assessment.risk, "MODERATE")
        XCTAssertEqual(assessment.combinedRiskScore, 33)
        XCTAssertEqual(assessment.recentLogs?.first?.level, "MEDIUM")
    }

    func testStravaStatusDecodesConnectionAndSyncState() throws {
        let data = #"{"configured":true,"linked":true,"mode":"configured","syncStatus":{"status":"RUNNING","importedRuns":2,"processedActivities":4,"active":true}}"#.data(using: .utf8)!
        let status = try JSONDecoder().decode(HermesStravaStatus.self, from: data)

        XCTAssertEqual(status.linked, true)
        XCTAssertEqual(status.syncStatus?.status, "RUNNING")
        XCTAssertEqual(status.syncStatus?.importedRuns, 2)
    }

    func testRunAnalyticsDecodesPostRunReviewAndTelemetry() throws {
        let data = #"{"laps":[{"lapIndex":1,"distanceKm":1.0,"durationSeconds":360,"pace":"6:00 /km","averageHeartRate":145}],"averageCadence":176.0,"averageStrideLengthMeters":1.02,"cardiacDrift":{"driftPercent":3.4},"debrief":{"interpretation":"Controlled aerobic work.","readinessScore":82,"nextDayGuidance":"Keep tomorrow easy."}}"#.data(using: .utf8)!
        let analytics = try JSONDecoder().decode(HermesRunAnalytics.self, from: data)

        XCTAssertEqual(analytics.laps?.first?.averageHeartRate, 145)
        XCTAssertEqual(analytics.cardiacDrift?.driftPercent, 3.4)
        XCTAssertEqual(analytics.debrief?.readinessScore, 82)
    }

    func testRoutePointsDecodeForNativeMap() throws {
        let data = #"[{"latitude":12.345,"longitude":-45.678},{"latitude":12.346,"longitude":-45.679}]"#.data(using: .utf8)!
        let points = try JSONDecoder().decode([HermesRoutePoint].self, from: data)

        XCTAssertEqual(points.count, 2)
        XCTAssertEqual(points.last?.latitude, 12.346)
    }
}
