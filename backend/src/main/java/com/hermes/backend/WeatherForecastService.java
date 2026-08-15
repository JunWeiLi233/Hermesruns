package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@Service
public class WeatherForecastService {
    private static final Logger log = LoggerFactory.getLogger(WeatherForecastService.class);
    private static final String OPEN_METEO_FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
    static final String OPEN_METEO_FORECAST_LIMITER_KEY = "forecast";
    private static final String CURRENT_FIELDS = String.join(",",
            "temperature_2m",
            "apparent_temperature",
            "dew_point_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code"
    );

    private final RestTemplate restTemplate;
    private final OpenMeteoRateLimiter rateLimiter;
    private final NationalWeatherServiceForecastClient nationalWeatherServiceFallback;

    @Autowired
    public WeatherForecastService(OpenMeteoRateLimiter rateLimiter,
                                   NationalWeatherServiceForecastClient nationalWeatherServiceFallback) {
        this(createRestTemplate(), rateLimiter, nationalWeatherServiceFallback);
    }

    WeatherForecastService(RestTemplate restTemplate,
                           OpenMeteoRateLimiter rateLimiter,
                           NationalWeatherServiceForecastClient nationalWeatherServiceFallback) {
        this.restTemplate = restTemplate;
        this.rateLimiter = rateLimiter;
        this.nationalWeatherServiceFallback = nationalWeatherServiceFallback;
    }

    public Map<String, Object> fetchForecast(double latitude, double longitude) {
        try {
            return fetchFromOpenMeteo(latitude, longitude);
        } catch (WeatherProviderRateLimitedException | RestClientException exception) {
            Map<String, Object> fallback = nationalWeatherServiceFallback.tryFetchForecast(latitude, longitude);
            if (fallback != null && !fallback.isEmpty()) {
                log.warn("Open-Meteo forecast unavailable ({}); serving National Weather Service fallback.",
                        exception.getMessage());
                return fallback;
            }
            throw exception;
        }
    }

    private Map<String, Object> fetchFromOpenMeteo(double latitude, double longitude) {
        if (rateLimiter.shouldThrottle(OPEN_METEO_FORECAST_LIMITER_KEY)) {
            log.debug("Open-Meteo forecast API is currently throttled; skipping forecast fetch for ({}, {})",
                    latitude, longitude);
            throw new WeatherProviderRateLimitedException("Weather provider rate limited; backing off.");
        }

        URI uri = UriComponentsBuilder
                .fromUriString(OPEN_METEO_FORECAST_ENDPOINT)
                .queryParam("latitude", latitude)
                .queryParam("longitude", longitude)
                .queryParam("current", CURRENT_FIELDS)
                .queryParam("hourly", "temperature_2m,weather_code")
                .queryParam("cell_selection", "land")
                .queryParam("temperature_unit", "celsius")
                .queryParam("wind_speed_unit", "kmh")
                .queryParam("forecast_hours", 12)
                .queryParam("timezone", "auto")
                .build()
                .encode()
                .toUri();

        RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    request,
                    new ParameterizedTypeReference<>() {}
            );
            rateLimiter.recordSuccess(OPEN_METEO_FORECAST_LIMITER_KEY);
            Map<String, Object> payload = response.getBody();
            if (payload == null) {
                throw new IllegalStateException("Weather provider returned an empty forecast.");
            }
            return payload;
        } catch (HttpClientErrorException exception) {
            if (exception.getStatusCode().value() == 429) {
                rateLimiter.recordRateLimited(OPEN_METEO_FORECAST_LIMITER_KEY);
                log.warn("Open-Meteo forecast API returned 429 Too Many Requests; subsequent calls in this window are throttled.");
                throw new WeatherProviderRateLimitedException("Weather provider rate limited.");
            }
            log.warn("Open-Meteo forecast API returned HTTP {}: {}",
                    exception.getStatusCode().value(), exception.getMessage());
            throw exception;
        }
    }

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(12_000);
        return new RestTemplate(factory);
    }
}
