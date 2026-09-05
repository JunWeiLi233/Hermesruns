package com.hermes.backend.weather;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

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

    @ParameterizedTest(name = "accepts weather coordinates for {0}")
    @CsvSource({
            "Iceland, 64.1466, -21.9426",
            "Brazil, -15.7939, -47.8828",
            "Kenya, -1.2921, 36.8219",
            "Japan, 35.6762, 139.6503",
            "Fiji, -18.1248, 178.4501"
    })
    void getContextPassesGlobalBrowserCoordinatesToWeatherService(
            String country,
            double latitude,
            double longitude
    ) {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        AcclimatizationService.WeatherContextResponse payload = new AcclimatizationService.WeatherContextResponse(
                true, latitude, longitude, 24.0, 20.0, 4.0, true, 4.0, 10, 1, 1.0, "day_1_3", "Heat"
        );
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(acclimatizationService.buildContext(runner, latitude, longitude)).thenReturn(payload);
        WeatherContextController controller = controller(authService, acclimatizationService, fitnessService, activityRepository);

        ResponseEntity<?> response = controller.getContext("Bearer runner-token", latitude, longitude);

        assertThat(response.getStatusCode())
                .as("weather context status for %s", country)
                .isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
        verify(acclimatizationService).buildContext(runner, latitude, longitude);
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

    @Test
    void getForecastReturnsSameOriginWeatherPayloadForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        WeatherForecastService forecastService = mock(WeatherForecastService.class);
        Runner runner = runner();
        Map<String, Object> payload = Map.of("current", Map.of("temperature_2m", 21.5));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(forecastService.fetchForecast(40.7128, -74.0060)).thenReturn(payload);
        WeatherContextController controller = controller(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                forecastService
        );

        ResponseEntity<?> response = controller.getForecast("Bearer runner-token", 40.7128, -74.0060);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
        verify(forecastService).fetchForecast(40.7128, -74.0060);
    }

    @Test
    void getForecastRejectsInvalidCoordinatesBeforeCallingProvider() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        WeatherForecastService forecastService = mock(WeatherForecastService.class);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner()));
        WeatherContextController controller = controller(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                forecastService
        );

        ResponseEntity<?> response = controller.getForecast("Bearer runner-token", 91.0, -74.0060);

        assertError(response, HttpStatus.BAD_REQUEST, "Invalid weather coordinates.");
        verifyNoInteractions(forecastService);
    }

    @Test
    void getForecastMapsProviderRateLimitToTooManyRequests() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        WeatherForecastService forecastService = mock(WeatherForecastService.class);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner()));
        when(forecastService.fetchForecast(40.7128, -74.0060))
                .thenThrow(new WeatherProviderRateLimitedException("Weather provider rate limited."));
        WeatherContextController controller = controller(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                forecastService
        );

        ResponseEntity<?> response = controller.getForecast("Bearer runner-token", 40.7128, -74.0060);

        assertError(response, HttpStatus.TOO_MANY_REQUESTS, "Weather provider rate limited. Please try again later.");
    }

    @Test
    void getForecastMapsUnexpectedProviderFailureToBadGateway() {
        AuthService authService = mock(AuthService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        WeatherAdjustedFitnessService fitnessService = mock(WeatherAdjustedFitnessService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        WeatherForecastService forecastService = mock(WeatherForecastService.class);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner()));
        when(forecastService.fetchForecast(40.7128, -74.0060))
                .thenThrow(new IllegalStateException("boom"));
        WeatherContextController controller = controller(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                forecastService
        );

        ResponseEntity<?> response = controller.getForecast("Bearer runner-token", 40.7128, -74.0060);

        assertError(response, HttpStatus.BAD_GATEWAY, "Weather provider unavailable.");
    }

    private WeatherContextController controller(
            AuthService authService,
            AcclimatizationService acclimatizationService,
            WeatherAdjustedFitnessService fitnessService,
            ActivityRepository activityRepository
    ) {
        return controller(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                mock(WeatherForecastService.class)
        );
    }

    private WeatherContextController controller(
            AuthService authService,
            AcclimatizationService acclimatizationService,
            WeatherAdjustedFitnessService fitnessService,
            ActivityRepository activityRepository,
            WeatherForecastService forecastService
    ) {
        return new WeatherContextController(
                authService,
                acclimatizationService,
                fitnessService,
                activityRepository,
                forecastService
        );
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
