package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AcclimatizationServiceTests {

    @Test
    void buildContextReturnsUnavailableWhenNoRecentRunGpsPointsExist() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name())).thenReturn(List.of());

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isFalse();
        assertThat(response.message()).isEqualTo("No recent run GPS points found.");
        verify(activityRepository, never()).findRunsBetween(any(), any(), any(), any());
    }

    @Test
    void buildContextReturnsUnavailableWhenWeatherProviderHasNoDewPointSeries() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any())).thenReturn(List.of());
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("daily", Map.of())));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isFalse();
        assertThat(response.message()).isEqualTo("Weather provider returned no dew point data.");
    }

    @Test
    void buildContextUsesRunDayExposureForBaselineAndAppliesAcclimatizationPenalty() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        LocalDate today = LocalDate.now();

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any()))
                .thenReturn(List.of(
                        runAt(today.minusDays(6).atTime(7, 0)),
                        runAt(today.minusDays(5).atTime(7, 0))
                ));
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(archiveWeather(
                today.minusDays(14), today,
                Map.of(
                        today.minusDays(6), 12.0,
                        today.minusDays(5), 16.0,
                        today, 22.0
                ),
                10.0
        )));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isTrue();
        assertThat(response.baselineDewPoint14dC()).isEqualTo(14.0);
        assertThat(response.currentDewPointC()).isEqualTo(22.0);
        assertThat(response.climateShockDeltaC()).isEqualTo(8.0);
        assertThat(response.climateShockEvent()).isTrue();
        assertThat(response.acclimatizationDay()).isEqualTo(6);
        assertThat(response.penaltyFactor()).isEqualTo(0.5);
        // Research-calibrated: (22°C dew - 13°C trigger) × 2 s/km/°C = 18 s/km full,
        // × 0.5 acclimatization factor on day 6 = 9 s/km. Previous value of 42 s/km
        // came from a 12 s/km/°C coefficient with no ceiling — ~4× the published
        // 0.3–1.0 %/°C range (Maughan, Cheuvront 2010, Roecker 2013).
        assertThat(response.pacePenaltySecPerKm()).isEqualTo(9);
        assertThat(response.acclimatizationStatus()).isEqualTo("day_4_9");
        assertThat(response.message()).contains("+9s/km");
    }

    @Test
    void buildContextFallsBackToSeriesAverageWhenNoRunDayExposureExists() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        LocalDate today = LocalDate.now();

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any())).thenReturn(List.of());
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(archiveWeather(
                today.minusDays(2), today,
                Map.of(
                        today.minusDays(2), 10.0,
                        today.minusDays(1), 12.0,
                        today, 14.0
                ),
                12.0
        )));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isTrue();
        assertThat(response.baselineDewPoint14dC()).isEqualTo(12.0);
        assertThat(response.currentDewPointC()).isEqualTo(14.0);
        assertThat(response.climateShockDeltaC()).isEqualTo(2.0);
        assertThat(response.climateShockEvent()).isFalse();
        // Under the calibrated model the 13 °C trigger fires at 14 °C dew point:
        // (14 - 13) × 2 = 2 s/km. Below the 26 °C safety-warning threshold, so the
        // standard baseline-fading message is rendered.
        assertThat(response.pacePenaltySecPerKm()).isEqualTo(2);
        assertThat(response.message()).contains("+2s/km");
    }

    @Test
    void buildContextReturnsUnavailableWhenOpenMeteoReturns429() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any())).thenReturn(List.of());
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenThrow(HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS, "429 Too Many Requests",
                null, null, StandardCharsets.UTF_8
        ));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isFalse();
        assertThat(response.message()).isEqualTo("Weather provider returned no dew point data.");
    }

    @Test
    void subsequentCallIsThrottledAfter429() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any())).thenReturn(List.of());
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        ))
                // First call: 429
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.TOO_MANY_REQUESTS, "429 Too Many Requests",
                        null, null, StandardCharsets.UTF_8
                ))
                // Second call (should be throttled and not hit the API, but if it does, return success)
                .thenReturn(ResponseEntity.ok(archiveWeather(
                        LocalDate.now().minusDays(2), LocalDate.now(),
                        Map.of(LocalDate.now(), 12.0),
                        12.0
                )));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        // First call: gets 429, returns unavailable, rate limiter records the event
        AcclimatizationService.WeatherContextResponse first = service.buildContext(runner());
        assertThat(first.available()).isFalse();

        // Second call: rate limiter should throttle (same service instance), returns unavailable
        // Since the rate limiter has a 30s backoff, and both calls happen in the same test,
        // the second call should be throttled without hitting the REST template.
        AcclimatizationService.WeatherContextResponse second = service.buildContext(runner());
        assertThat(second.available()).isFalse();

        // The REST template should have been called exactly once (the first call)
        verify(restTemplate).exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        );
    }

    @Test
    void externalExceptionStillReturnsUnavailableGracefully() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        when(activityPointRepository.findLatestLatLngByRunnerAndType(7L, ActivityType.RUN.name()))
                .thenReturn(List.<Object[]>of(new Object[]{31.2304, 121.4737}));
        when(activityRepository.findRunsBetween(any(), any(), any(), any())).thenReturn(List.of());
        when(restTemplate.exchange(
                ArgumentMatchers.<RequestEntity<?>>any(),
                ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenThrow(new RuntimeException("Connection reset"));

        AcclimatizationService service = new AcclimatizationService(activityRepository, activityPointRepository, restTemplate);

        AcclimatizationService.WeatherContextResponse response = service.buildContext(runner());

        assertThat(response.available()).isFalse();
        assertThat(response.message()).isEqualTo("Weather provider returned no dew point data.");
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    private Activity runAt(LocalDateTime startTime) {
        Activity activity = new Activity();
        activity.setStartTime(startTime);
        return activity;
    }

    private Map<String, Object> archiveWeather(LocalDate start, LocalDate end, Map<LocalDate, Double> explicitValues, double fallback) {
        Map<String, Object> daily = new LinkedHashMap<>();
        List<String> times = new java.util.ArrayList<>();
        List<Double> dews = new java.util.ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            times.add(date.toString());
            dews.add(explicitValues.getOrDefault(date, fallback));
        }
        daily.put("time", times);
        daily.put("dew_point_2m_mean", dews);
        return Map.of("daily", daily);
    }
}
