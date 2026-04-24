package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class WeatherContextControllerTests {

    @Test
    void getContextRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        WeatherContextController controller = controller(authService, acclimatizationService, fitnessService, activityRepository);

        ResponseEntity<?> response = controller.getContext(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        verifyNoInteractions(acclimatizationService);
    }

    @Test
    void getContextReturnsWeatherContextPayloadForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        AcclimatizationService.WeatherContextResponse payload = new AcclimatizationService.WeatherContextResponse(
                true,
                1.23,
                4.56,
                22.2,
                18.1,
                4.1,
                true,
                4.0,
                26,
                3,
                1.0,
                "day_1_3",
                "Extreme Heat Detected."
        );
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(acclimatizationService.buildContext(runner)).thenReturn(payload);
        WeatherContextController controller = controller(authService, acclimatizationService, fitnessService, activityRepository);

        ResponseEntity<?> response = controller.getContext("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
        verify(acclimatizationService).buildContext(runner);
    }

    @Test
    void getContextReturnsBadRequestWhenServiceRejectsRunnerContext() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(acclimatizationService.buildContext(runner))
                .thenThrow(new IllegalArgumentException("No recent run GPS points found."));
        WeatherContextController controller = controller(authService, acclimatizationService, fitnessService, activityRepository);

        ResponseEntity<?> response = controller.getContext("Bearer runner-token");

        assertError(response, HttpStatus.BAD_REQUEST, "No recent run GPS points found.");
    }

    @Test
    void getContextReturnsServerErrorMapWhenServiceFailsUnexpectedly() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(acclimatizationService.buildContext(runner)).thenThrow(new IllegalStateException("boom"));
        WeatherContextController controller = controller(authService, acclimatizationService, fitnessService, activityRepository);

        ResponseEntity<?> response = controller.getContext("Bearer runner-token");

        assertError(response, HttpStatus.INTERNAL_SERVER_ERROR, "Server error");
    }

    private WeatherContextController controller(
            AuthService authService,
            AcclimatizationService acclimatizationService,
            WeatherAdjustedFitnessService fitnessService,
            ActivityRepository activityRepository
    ) {
        return new WeatherContextController(authService, acclimatizationService, fitnessService, activityRepository);
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(5L);
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
