package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileControllerTests {

    @Test
    void meRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.me(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void updateDisplayNameRejectsBlankName() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.updateDisplayName(
                "Bearer runner-token",
                new ProfileController.UpdateDisplayNameRequest("   "));

        assertError(response, HttpStatus.BAD_REQUEST, "Display name is required.");
    }

    @Test
    void updateDisplayNameRejectsUnsafeCharacters() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.updateDisplayName(
                "Bearer runner-token",
                new ProfileController.UpdateDisplayNameRequest("<script>alert(1)</script>"));

        assertError(response, HttpStatus.BAD_REQUEST, "Display name contains invalid characters.");
    }

    @Test
    void updateDisplayNamePersistsNormalizedName() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(runnerRepository.save(runner)).thenReturn(runner);
        ProfileController controller = controller(
                authService,
                runnerRepository,
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class)
        );

        ResponseEntity<?> response = controller.updateDisplayName(
                "Bearer runner-token",
                new ProfileController.UpdateDisplayNameRequest("  Hermes Runner  "));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(new ProfileController.ProfileResponse(
                "runner@hermes.test",
                "Hermes Runner",
                true,
                true
        ));
        verify(runnerRepository).save(runner);
    }

    @Test
    void getPreferencesRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.getPreferences(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void getPreferencesReturnsStoredMantraAndDigest() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        runner.setSettingsMantra("Hold marathon pace after the bridge");
        runner.setWeeklyDigestEnabled(true);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.getPreferences("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(new ProfileController.ProfilePreferencesResponse(
                "Hold marathon pace after the bridge",
                true
        ));
    }

    @Test
    void updatePreferencesPersistsMantraAndDigest() {
        AuthService authService = mock(AuthService.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(runnerRepository.save(runner)).thenReturn(runner);
        ProfileController controller = controller(
                authService,
                runnerRepository,
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class)
        );

        ResponseEntity<?> response = controller.updatePreferences(
                "Bearer runner-token",
                new ProfileController.ProfilePreferencesRequest("  Smooth through the first 10K  ", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(new ProfileController.ProfilePreferencesResponse(
                "Smooth through the first 10K",
                true
        ));
        assertThat(runner.getSettingsMantra()).isEqualTo("Smooth through the first 10K");
        assertThat(runner.isWeeklyDigestEnabled()).isTrue();
        verify(runnerRepository).save(runner);
    }

    @Test
    void updatePreferencesRejectsUnsafeMantra() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.updatePreferences(
                "Bearer runner-token",
                new ProfileController.ProfilePreferencesRequest("<b>run brave</b>", false));

        assertError(response, HttpStatus.BAD_REQUEST, "Training mantra contains invalid characters.");
    }

    @Test
    void heatmapReturnsEmptyPayloadWhenRunnerHasNoRuns() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.existsByRunnerAndActivityTypeIsNull(runner)).thenReturn(false);
        when(activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN)).thenReturn(0L);
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class)
        );

        ResponseEntity<?> response = controller.heatmap("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(new ProfileController.HeatmapResponse(List.of(), 0, 0, 0, null));
    }

    @Test
    void personalRecordsRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.personalRecords(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void personalRecordsReturnsServicePayloadForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        PersonalRecordService personalRecordService = mock(PersonalRecordService.class);
        Runner runner = runner();
        PersonalRecordService.PersonalRecordsResponse payload = new PersonalRecordService.PersonalRecordsResponse(
                List.of(),
                Map.of(),
                null,
                null,
                null
        );
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(personalRecordService.buildForRunner(runner)).thenReturn(payload);
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                personalRecordService,
                mock(QuotaService.class)
        );

        ResponseEntity<?> response = controller.personalRecords("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
    }

    @Test
    void profileDashboardRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.profileDashboard(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void profileDashboardReturnsEmptyDefaultsForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenReturn(List.of());
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class),
                mock(AutomatedCoachService.class),
                raceEventRepository,
                mock(MuscleTrainingPlannerService.class),
                mock(AcclimatizationService.class),
                mock(ShoeRepository.class)
        );

        ResponseEntity<?> response = controller.profileDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(ProfileController.ProfileDashboardResponse.class);
        ProfileController.ProfileDashboardResponse body = (ProfileController.ProfileDashboardResponse) response.getBody();
        assertThat(body.profile().email()).isEqualTo("runner@hermes.test");
        assertThat(body.activities()).isEmpty();
        assertThat(body.races()).isEmpty();
        assertThat(body.quota()).isEqualTo(Map.of());
        // coachToday is intentionally deferred so the synchronous Open-Meteo
        // call inside getTodayWithReadiness no longer blocks first paint; the
        // frontend lazy-loads it via /api/coach/today when this flag is true.
        assertThat(body.deferredEnrichment()).isTrue();
    }

    @Test
    void profileDashboardGracefullyFallsBackWhenBatchEnrichmentFails() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        PersonalRecordService personalRecordService = mock(PersonalRecordService.class);
        QuotaService quotaService = mock(QuotaService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        MuscleTrainingPlannerService muscleTrainingPlannerService = mock(MuscleTrainingPlannerService.class);
        Runner runner = runner();
        Activity activity = new Activity();
        activity.setId(85L);
        activity.setName("Fallback-safe run");
        activity.setDistanceKm(10.0);
        activity.setMovingTimeSeconds(3100);
        activity.setStartTime(LocalDateTime.of(2026, 4, 30, 6, 15));

        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(personalRecordService.buildForRunner(runner)).thenThrow(new IllegalStateException("records unavailable"));
        when(quotaService.getQuotaStatus(runner)).thenThrow(new IllegalStateException("quota unavailable"));
        when(automatedCoachService.getCoachState(runner)).thenThrow(new IllegalStateException("coach state unavailable"));
        when(automatedCoachService.getTodayWithReadiness(runner)).thenThrow(new IllegalStateException("today unavailable"));
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenThrow(new IllegalStateException("races unavailable"));
        when(muscleTrainingPlannerService.getPlan(runner, null, List.of())).thenThrow(new IllegalStateException("muscle plan unavailable"));
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                personalRecordService,
                quotaService,
                automatedCoachService,
                raceEventRepository,
                muscleTrainingPlannerService,
                mock(AcclimatizationService.class),
                mock(ShoeRepository.class)
        );

        ResponseEntity<?> response = controller.profileDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(ProfileController.ProfileDashboardResponse.class);
        ProfileController.ProfileDashboardResponse body = (ProfileController.ProfileDashboardResponse) response.getBody();
        assertThat(body.activities()).hasSize(1);
        assertThat(body.coachState()).isNull();
        assertThat(body.coachToday()).isNull();
        assertThat(body.personalRecords()).isNull();
        assertThat(body.races()).isEmpty();
        assertThat(body.musclePlan()).isNull();
        assertThat(body.quota()).isEqualTo(Map.of());
        // coachToday now deferred even when batch enrichment fails — the frontend
        // always lazy-loads /api/coach/today behind the deferredEnrichment flag.
        assertThat(body.deferredEnrichment()).isTrue();
    }

    @Test
    void profileDashboardReturnsBatchEnrichmentForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        PersonalRecordService personalRecordService = mock(PersonalRecordService.class);
        QuotaService quotaService = mock(QuotaService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        MuscleTrainingPlannerService muscleTrainingPlannerService = mock(MuscleTrainingPlannerService.class);
        Runner runner = runner();
        Activity activity = new Activity();
        activity.setId(84L);
        activity.setName("Batch dashboard run");
        activity.setDistanceKm(6.4);
        activity.setMovingTimeSeconds(1900);
        activity.setStartTime(LocalDateTime.of(2026, 4, 29, 6, 0));
        AutomatedCoachService.CoachStateDto coachState = new AutomatedCoachService.CoachStateDto(
                52.4, 194.8, 118,
                16, 8, 0,
                0.18, false,
                48, 50, 79, 68, 15,
                "steady", 86,
                82, "GREEN",
                80, 74, 83, 72,
                190, 49, null,
                null
        );
        AutomatedCoachService.CoachTodayDto coachToday = new AutomatedCoachService.CoachTodayDto(
                null,
                coachState,
                null,
                null
        );
        PersonalRecordService.PersonalRecordsResponse personalRecords = new PersonalRecordService.PersonalRecordsResponse(
                List.of(),
                Map.of("5k", new PersonalRecordService.DistanceRecord(
                        "5k",
                        5.0,
                        1320,
                        264.0,
                        "2026-04-29T06:00:00",
                        "Batch dashboard run",
                        activity.getId(),
                        activity.getDistanceKm(),
                        false
                )),
                null,
                null,
                null
        );
        Map<String, Object> quota = Map.of("pro", false);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = List.of(
                new AutomatedCoachService.CoachScheduledWorkoutDto(
                        LocalDateTime.of(2026, 4, 29, 6, 0).toLocalDate(),
                        "EASY",
                        6.4,
                        40,
                        false,
                        "Keep it smooth",
                        null,
                        false
                )
        );
        MusclePlanDto musclePlan = new MusclePlanDto(null, List.of(), List.of(), List.of(), null, "COACH_SCHEDULE");

        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(personalRecordService.buildForRunner(runner)).thenReturn(personalRecords);
        when(quotaService.getQuotaStatus(runner)).thenReturn(quota);
        when(automatedCoachService.getCoachState(runner)).thenReturn(coachState);
        when(automatedCoachService.getTodayWithReadiness(runner)).thenReturn(coachToday);
        when(automatedCoachService.getSchedule(runner, 7)).thenReturn(schedule);
        when(muscleTrainingPlannerService.getPlan(runner, coachState, schedule)).thenReturn(musclePlan);
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenReturn(List.of());
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                personalRecordService,
                quotaService,
                automatedCoachService,
                raceEventRepository,
                muscleTrainingPlannerService,
                mock(AcclimatizationService.class),
                mock(ShoeRepository.class)
        );

        ResponseEntity<?> response = controller.profileDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        ProfileController.ProfileDashboardResponse body = (ProfileController.ProfileDashboardResponse) response.getBody();
        assertThat(body.activities()).hasSize(1);
        assertThat(body.coachState()).isEqualTo(coachState);
        // coachToday is deferred (null in the eager payload) so the
        // synchronous Open-Meteo dew-point fetch no longer blocks first paint.
        // The frontend lazy-loads it via /api/coach/today when
        // deferredEnrichment=true.
        assertThat(body.coachToday()).isNull();
        assertThat(body.personalRecords()).isEqualTo(personalRecords);
        assertThat(body.races()).isEmpty();
        assertThat(body.musclePlan()).isEqualTo(musclePlan);
        assertThat(body.quota()).isEqualTo(quota);
        assertThat(body.deferredEnrichment()).isTrue();
        verify(personalRecordService).buildForRunner(runner);
        verify(quotaService).getQuotaStatus(runner);
        verify(automatedCoachService).getCoachState(runner);
        verify(automatedCoachService, never()).getTodayWithReadiness(runner);
        verify(automatedCoachService).getSchedule(runner, 7);
        verify(raceEventRepository).findByRunnerOrderByEventDateAsc(runner);
        verify(muscleTrainingPlannerService).getPlan(runner, coachState, schedule);
    }

    @Test
    void profileDashboardPreservesWeatherAdjustedActivityFields() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        Runner runner = runner();
        Activity activity = new Activity();
        activity.setId(42L);
        activity.setName("Heat adjusted run");
        activity.setDistanceKm(8.4);
        activity.setMovingTimeSeconds(2500);
        activity.setStartTime(LocalDateTime.of(2026, 4, 29, 7, 30));
        activity.setPacePenaltySecPerKm(12);
        activity.setWeatherAdjusted(true);

        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenReturn(List.of());
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class),
                mock(AutomatedCoachService.class),
                raceEventRepository,
                mock(MuscleTrainingPlannerService.class),
                mock(AcclimatizationService.class),
                mock(ShoeRepository.class)
        );

        ResponseEntity<?> response = controller.profileDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        ProfileController.ProfileDashboardResponse body = (ProfileController.ProfileDashboardResponse) response.getBody();
        assertThat(body.activities()).hasSize(1);
        assertThat(body.activities().get(0))
                .containsEntry("pacePenaltySecPerKm", 12)
                .containsEntry("weatherAdjusted", true);
    }

    @Test
    void todayDashboardRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ProfileController controller = controller(authService);

        ResponseEntity<?> response = controller.todayDashboard(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void todayDashboardReturnsEmptyDefaultsForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenReturn(List.of());
        when(shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of());
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class),
                mock(AutomatedCoachService.class),
                raceEventRepository,
                mock(MuscleTrainingPlannerService.class),
                mock(AcclimatizationService.class),
                shoeRepository
        );

        ResponseEntity<?> response = controller.todayDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(ProfileController.TodayDashboardResponse.class);
        ProfileController.TodayDashboardResponse body = (ProfileController.TodayDashboardResponse) response.getBody();
        assertThat(body.profile().email()).isEqualTo("runner@hermes.test");
        assertThat(body.activities()).isEmpty();
        assertThat(body.races()).isEmpty();
        assertThat(body.shoes()).isEmpty();
    }

    @Test
    void todayDashboardReturnsBatchPayloadForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        RaceEventRepository raceEventRepository = mock(RaceEventRepository.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        Runner runner = runner();
        Activity activity = new Activity();
        activity.setId(86L);
        activity.setName("Today dashboard run");
        activity.setDistanceKm(7.2);
        activity.setMovingTimeSeconds(2280);
        activity.setStartTime(LocalDateTime.of(2026, 5, 1, 6, 45));
        Shoe shoe = new Shoe();
        shoe.setId(12L);
        shoe.setModel("Race Companion");
        shoe.setBrand("Hermes");
        shoe.setRetired(false);
        shoe.setInitialDistanceKm(120.5);
        shoe.setCreatedAt(LocalDateTime.of(2026, 4, 1, 9, 0));
        AutomatedCoachService.CoachStateDto coachState = new AutomatedCoachService.CoachStateDto(
                48.9, 182.4, 112,
                15, 8, 0,
                0.92, false,
                47, 49, 82, 69, 12,
                "ready", 88,
                84, "GREEN",
                81, 75, 85, 73,
                188, 50, null,
                null
        );
        AutomatedCoachService.CoachTodayDto coachToday = new AutomatedCoachService.CoachTodayDto(
                null,
                coachState,
                null,
                null
        );
        AcclimatizationService.WeatherContextResponse weatherContext =
                new AcclimatizationService.WeatherContextResponse(
                        true,
                        37.822,
                        -122.25,
                        18.2,
                        14.1,
                        4.1,
                        true,
                        3.0,
                        12,
                        4,
                        0.72,
                        "moderate",
                        "Heat adjustment active"
                );

        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(activityRepository.sumDistanceKmByRunner(runner)).thenReturn(List.<Object[]>of(new Object[]{12L, 43.25}));
        when(automatedCoachService.getTodayWithReadiness(runner)).thenReturn(coachToday);
        when(acclimatizationService.buildContext(runner)).thenReturn(weatherContext);
        when(raceEventRepository.findByRunnerOrderByEventDateAsc(runner)).thenReturn(List.of());
        when(shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(shoe));
        ProfileController controller = controller(
                authService,
                mock(RunnerRepository.class),
                activityRepository,
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class),
                automatedCoachService,
                raceEventRepository,
                mock(MuscleTrainingPlannerService.class),
                acclimatizationService,
                shoeRepository
        );

        ResponseEntity<?> response = controller.todayDashboard("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(ProfileController.TodayDashboardResponse.class);
        ProfileController.TodayDashboardResponse body = (ProfileController.TodayDashboardResponse) response.getBody();
        assertThat(body.profile().email()).isEqualTo("runner@hermes.test");
        assertThat(body.activities()).hasSize(1);
        assertThat(body.coachToday()).isEqualTo(coachToday);
        assertThat(body.weather()).isEqualTo(weatherContext);
        assertThat(body.races()).isEmpty();
        assertThat(body.shoes()).hasSize(1);
        assertThat(body.shoes().get(0).getCurrentDistanceKm()).isEqualTo(163.75);
    }

    private ProfileController controller(AuthService authService) {
        return controller(
                authService,
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                mock(ActivityNormalizationService.class),
                mock(PersonalRecordService.class),
                mock(QuotaService.class)
        );
    }

    private ProfileController controller(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            PersonalRecordService personalRecordService,
            QuotaService quotaService
    ) {
        return new ProfileController(
                authService,
                runnerRepository,
                activityRepository,
                activityPointRepository,
                activityNormalizationService,
                personalRecordService,
                quotaService,
                mock(AutomatedCoachService.class),
                mock(RaceEventRepository.class),
                mock(MuscleTrainingPlannerService.class),
                mock(AcclimatizationService.class),
                mock(ShoeRepository.class)
        );
    }

    private ProfileController controller(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            PersonalRecordService personalRecordService,
            QuotaService quotaService,
            AutomatedCoachService automatedCoachService,
            RaceEventRepository raceEventRepository,
            MuscleTrainingPlannerService muscleTrainingPlannerService,
            AcclimatizationService acclimatizationService,
            ShoeRepository shoeRepository
    ) {
        return new ProfileController(
                authService,
                runnerRepository,
                activityRepository,
                activityPointRepository,
                activityNormalizationService,
                personalRecordService,
                quotaService,
                automatedCoachService,
                raceEventRepository,
                muscleTrainingPlannerService,
                acclimatizationService,
                shoeRepository
        );
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(5L);
        runner.setEmail("runner@hermes.test");
        runner.setDisplayName("Hermes");
        runner.setRole("USER");
        runner.setStatus("ACTIVE");
        runner.setCreatedAt(LocalDateTime.now());
        runner.setStravaAthleteId(99L);
        runner.setStravaRefreshToken("refresh-token");
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
