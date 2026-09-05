package com.hermes.backend.weather;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class WeatherForecastServiceTests {

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void fetchForecastUsesFixedOpenMeteoEndpointAndExpectedFields() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        Map<String, Object> payload = Map.of("current", Map.of("temperature_2m", 21.5));
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(payload));
        NationalWeatherServiceForecastClient fallback = mock(NationalWeatherServiceForecastClient.class);
        WeatherForecastService service = new WeatherForecastService(restTemplate, new OpenMeteoRateLimiter(), fallback);

        Map<String, Object> result = service.fetchForecast(40.7128, -74.0060);

        assertThat(result).isEqualTo(payload);
        ArgumentCaptor<RequestEntity> requestCaptor = ArgumentCaptor.forClass(RequestEntity.class);
        verify(restTemplate).exchange(requestCaptor.capture(), any(ParameterizedTypeReference.class));
        String url = requestCaptor.getValue().getUrl().toString();
        assertThat(url).startsWith("https://api.open-meteo.com/v1/forecast?");
        assertThat(url).contains("latitude=40.7128");
        assertThat(url).contains("longitude=-74.006");
        assertThat(url).contains("current=temperature_2m");
        assertThat(url).contains("hourly=temperature_2m");
        assertThat(url).contains("forecast_hours=12");
        assertThat(url).contains("timezone=auto");
        assertThat(url).doesNotContain("models=");
        verifyNoInteractions(fallback);
    }

    @Test
    void fetchForecastServesNationalWeatherServiceFallbackWhileOpenMeteoIsThrottled() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        OpenMeteoRateLimiter rateLimiter = new OpenMeteoRateLimiter();
        rateLimiter.recordRateLimited(WeatherForecastService.OPEN_METEO_FORECAST_LIMITER_KEY);
        Map<String, Object> fallbackPayload = Map.of("current", Map.of("temperature_2m", 30.0));
        NationalWeatherServiceForecastClient fallback = mock(NationalWeatherServiceForecastClient.class);
        when(fallback.tryFetchForecast(40.7128, -74.0060)).thenReturn(fallbackPayload);
        WeatherForecastService service = new WeatherForecastService(restTemplate, rateLimiter, fallback);

        Map<String, Object> result = service.fetchForecast(40.7128, -74.0060);

        assertThat(result).isEqualTo(fallbackPayload);
        verifyNoInteractions(restTemplate);
    }

    @Test
    void fetchForecastServesNationalWeatherServiceFallbackWhenProviderFails() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenThrow(HttpServerErrorException.create(
                        HttpStatus.SERVICE_UNAVAILABLE, "Service Unavailable", null, null, null));
        Map<String, Object> fallbackPayload = Map.of("current", Map.of("temperature_2m", 29.4));
        NationalWeatherServiceForecastClient fallback = mock(NationalWeatherServiceForecastClient.class);
        when(fallback.tryFetchForecast(40.7128, -74.0060)).thenReturn(fallbackPayload);
        WeatherForecastService service = new WeatherForecastService(restTemplate, new OpenMeteoRateLimiter(), fallback);

        Map<String, Object> result = service.fetchForecast(40.7128, -74.0060);

        assertThat(result).isEqualTo(fallbackPayload);
        verify(fallback).tryFetchForecast(40.7128, -74.0060);
    }

    @Test
    void fetchForecastThrowsRateLimitedWhenThrottledAndFallbackUnavailable() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        OpenMeteoRateLimiter rateLimiter = new OpenMeteoRateLimiter();
        rateLimiter.recordRateLimited(WeatherForecastService.OPEN_METEO_FORECAST_LIMITER_KEY);
        NationalWeatherServiceForecastClient fallback = mock(NationalWeatherServiceForecastClient.class);
        WeatherForecastService service = new WeatherForecastService(restTemplate, rateLimiter, fallback);

        assertThatThrownBy(() -> service.fetchForecast(40.7128, -74.0060))
                .isInstanceOf(WeatherProviderRateLimitedException.class);

        verifyNoInteractions(restTemplate);
    }

    @Test
    void fetchForecastMapsProvider429ToRateLimitedExceptionAndArmsThrottle() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests", null, null, null));
        NationalWeatherServiceForecastClient fallback = mock(NationalWeatherServiceForecastClient.class);
        WeatherForecastService service = new WeatherForecastService(restTemplate, new OpenMeteoRateLimiter(), fallback);

        assertThatThrownBy(() -> service.fetchForecast(40.7128, -74.0060))
                .isInstanceOf(WeatherProviderRateLimitedException.class);

        // The 429 must arm the shared backoff so the next call never leaves the JVM.
        assertThatThrownBy(() -> service.fetchForecast(40.7128, -74.0060))
                .isInstanceOf(WeatherProviderRateLimitedException.class);
        verify(restTemplate, times(1)).exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class));
    }
}
