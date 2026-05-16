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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
    }

    @Test
    void profileDashboardDefersExpensiveEnrichmentForFastFirstPaint() {
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
        activity.setName("Fast first paint run");
        activity.setDistanceKm(6.4);
        activity.setMovingTimeSeconds(1900);
        activity.setStartTime(LocalDateTime.of(2026, 4, 29, 6, 0));

        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
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
        assertThat(body.coachState()).isNull();
        assertThat(body.coachToday()).isNull();
        assertThat(body.personalRecords()).isNull();
        assertThat(body.races()).isEmpty();
        assertThat(body.musclePlan()).isNull();
        assertThat(body.quota()).isEqualTo(Map.of());
        assertThat(body.deferredEnrichment()).isTrue();
        verifyNoInteractions(personalRecordService, quotaService, automatedCoachService, raceEventRepository, muscleTrainingPlannerService);
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
