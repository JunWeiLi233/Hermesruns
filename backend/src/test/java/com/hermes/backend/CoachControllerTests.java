package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CoachControllerTests {

    @Test
    void getStateRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        CoachController controller = coachController(authService, mock(AutomatedCoachService.class));

        ResponseEntity<?> response = controller.getState(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void getScheduleReturnsCoachScheduleForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = List.of(
                new AutomatedCoachService.CoachScheduledWorkoutDto(
                        LocalDate.now(),
                        "EASY_RUN",
                        10.0,
                        50,
                        false,
                        "Keep it smooth.",
                        null,
                        false));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(coachService.getSchedule(runner, 21)).thenReturn(schedule);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.getSchedule("Bearer runner-token", 21);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(schedule);
    }

    @Test
    void getTodayReturnsRouteRecommendationForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        AutomatedCoachService.CoachTodayDto payload = new AutomatedCoachService.CoachTodayDto(
                new AutomatedCoachService.CoachScheduledWorkoutDto(
                        LocalDate.now(),
                        "EASY",
                        10.0,
                        50,
                        false,
                        "Keep the effort smooth.",
                        null,
                        false
                ),
                coachState(),
                new CoachRouteRecommendationDto(
                        "north-east",
                        "distance-match",
                        10.0,
                        10.1,
                        2,
                        new CoachRoutePreviewDto("M 10.00 10.00 L 20.00 20.00", 10.0, 10.0, 20.0, 20.0)
                ),
                null
        );
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(coachService.getTodayWithReadiness(runner)).thenReturn(payload);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.getToday("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
    }

    @Test
    void postRecoveryReturnsBadRequestWhenServiceRejectsMetrics() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        IllegalArgumentException invalid = new IllegalArgumentException("restingHeartRateBpm must be between 20 and 120.");
        org.mockito.Mockito.doThrow(invalid).when(coachService).logRecoveryMetrics(runner, 10, 85, 60, null);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.postRecovery(
                "Bearer runner-token",
                new CoachController.RecoveryBody(10, 85, 60, null));

        assertError(response, HttpStatus.BAD_REQUEST, "restingHeartRateBpm must be between 20 and 120.");
    }

    @Test
    void patchProfileReturnsBadRequestWhenServiceRejectsRanges() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        IllegalArgumentException invalid = new IllegalArgumentException("maxHeartRateBpm must be greater than restingHeartRateBpm.");
        org.mockito.Mockito.doThrow(invalid).when(coachService).updateCoachProfile(runner, 45, 50);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.patchProfile(
                "Bearer runner-token",
                new CoachController.CoachProfileBody(45, 50));

        assertError(response, HttpStatus.BAD_REQUEST, "maxHeartRateBpm must be greater than restingHeartRateBpm.");
    }

    @Test
    void startBlockRejectsMissingRaceDistance() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        CoachController controller = coachController(authService, mock(AutomatedCoachService.class));

        ResponseEntity<?> response = controller.startBlock(
                "Bearer runner-token",
                new CoachController.TrainingBlockBody(null, LocalDate.now().plusWeeks(12), "Spring Build"));

        assertError(response, HttpStatus.BAD_REQUEST, "raceDistanceKm is required.");
    }

    @Test
    void startBlockRejectsUnsafeBlockName() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        CoachController controller = coachController(authService, mock(AutomatedCoachService.class));

        ResponseEntity<?> response = controller.startBlock(
                "Bearer runner-token",
                new CoachController.TrainingBlockBody(42.2, LocalDate.now().plusWeeks(12), "<script>alert(1)</script>"));

        assertError(response, HttpStatus.BAD_REQUEST, "name contains invalid characters.");
    }

    @Test
    void startBlockReturnsCoachStateAfterValidRequest() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        AutomatedCoachService.CoachStateDto state = coachState();
        LocalDate targetRaceDate = LocalDate.now().plusWeeks(10);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(coachService.getCoachState(runner)).thenReturn(state);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.startBlock(
                "Bearer runner-token",
                new CoachController.TrainingBlockBody(21.1, targetRaceDate, "Half Build"));

        verify(coachService).startTrainingBlock(runner, 21.1, targetRaceDate, "Half Build");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(state);
    }

    @Test
    void listAlertsReturnsCoachAlertsForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        List<AutomatedCoachService.CoachFeedbackAlertDto> alerts = List.of(
                new AutomatedCoachService.CoachFeedbackAlertDto(5L, "GREY_ZONE", "Too much middle-zone work.", LocalDateTime.now()));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(coachService.listAlerts(runner)).thenReturn(alerts);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.listAlerts("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(alerts);
    }

    @Test
    void dismissAlertReturnsNotFoundWhenAlertIsMissing() {
        AuthService authService = mock(AuthService.class);
        AutomatedCoachService coachService = mock(AutomatedCoachService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(coachService.dismissAlert(runner, 88L)).thenReturn(false);
        CoachController controller = coachController(authService, coachService);

        ResponseEntity<?> response = controller.dismissAlert("Bearer runner-token", 88L);

        assertError(response, HttpStatus.NOT_FOUND, "Alert not found.");
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }

    private CoachController coachController(AuthService authService, AutomatedCoachService coachService) {
        return new CoachController(authService, coachService, mock(ReadinessService.class));
    }

    private AutomatedCoachService.CoachStateDto coachState() {
        return new AutomatedCoachService.CoachStateDto(
                42.0,
                150.0,
                180,
                25,
                40,
                0,
                0.18,
                false,
                48,
                50,
                82,
                62,
                188,
                "ready",
                48,
                84,
                "GO",
                82,
                62,
                48,
                40,
                185,
                50,
                new AutomatedCoachService.CoachStaminaDto(95, 98, 300, 115, "down"),
                new AutomatedCoachService.CoachTrainingBlockDto(21.1, LocalDate.now().plusWeeks(10), 0, 18.0, "Half Build"));
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
