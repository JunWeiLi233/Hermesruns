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
                quotaService
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
