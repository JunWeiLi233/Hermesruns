package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@Service
public class WeatherForecastService {
    private static final String OPEN_METEO_FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
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

    public WeatherForecastService() {
        this(createRestTemplate());
    }

    WeatherForecastService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> fetchForecast(double latitude, double longitude) {
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
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                request,
                new ParameterizedTypeReference<>() {}
        );
        Map<String, Object> payload = response.getBody();
        if (payload == null) {
            throw new IllegalStateException("Weather provider returned an empty forecast.");
        }
        return payload;
    }

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(12_000);
        return new RestTemplate(factory);
    }
}
