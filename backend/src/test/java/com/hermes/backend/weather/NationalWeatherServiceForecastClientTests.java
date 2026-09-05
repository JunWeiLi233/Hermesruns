package com.hermes.backend.weather;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NationalWeatherServiceForecastClientTests {

    @Test
    void fetchForecastConvertsNwsPeriodsIntoOpenMeteoShapedPayload() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(pointsBody()))
                .thenReturn(ResponseEntity.ok(hourlyBody()));
        NationalWeatherServiceForecastClient client = new NationalWeatherServiceForecastClient(restTemplate);

        Map<String, Object> payload = client.fetchForecast(40.7519, -73.8204);

        assertThat(payload.get("timezone")).isEqualTo("America/New_York");

        @SuppressWarnings("unchecked")
        Map<String, Object> current = (Map<String, Object>) payload.get("current");
        assertThat(current.get("time")).isEqualTo("2026-08-14T17:00");
        assertThat((Double) current.get("temperature_2m")).isEqualTo(30.0);
        assertThat((Double) current.get("apparent_temperature")).isCloseTo(28.97, org.assertj.core.data.Offset.offset(0.05));
        assertThat((Double) current.get("dew_point_2m")).isEqualTo(13.88888888888889);
        assertThat((Double) current.get("relative_humidity_2m")).isEqualTo(37.0);
        assertThat((Double) current.get("wind_speed_10m")).isCloseTo(11.265, org.assertj.core.data.Offset.offset(0.001));
        assertThat(current.get("wind_direction_10m")).isEqualTo(315);
        assertThat(current.get("weather_code")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> hourly = (Map<String, Object>) payload.get("hourly");
        assertThat((List<String>) hourly.get("time"))
                .containsExactly("2026-08-14T17:00", "2026-08-14T18:00");
        assertThat((List<Double>) hourly.get("temperature_2m"))
                .hasSize(2);
        assertThat(hourly.get("temperature_2m"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST)
                .contains(30.0, (85.0 - 32.0) * 5.0 / 9.0);
        assertThat((List<Integer>) hourly.get("weather_code")).containsExactly(1, 2);
    }

    @Test
    void tryFetchForecastReturnsNullOutsideUnitedStatesGrid() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null));
        NationalWeatherServiceForecastClient client = new NationalWeatherServiceForecastClient(restTemplate);

        assertThat(client.tryFetchForecast(48.8566, 2.3522)).isNull();
    }

    @Test
    void tryFetchForecastReturnsNullWhenResponseIsMissingPeriods() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(pointsBody()))
                .thenReturn(ResponseEntity.ok(Map.of("properties", Map.of())));
        NationalWeatherServiceForecastClient client = new NationalWeatherServiceForecastClient(restTemplate);

        assertThat(client.tryFetchForecast(40.7519, -73.8204)).isNull();
    }

    @Test
    void rejectsForecastHourlyUrlOutsideWeatherGovBeforeSecondRequest() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of("properties", Map.of(
                        "forecastHourly", "http://169.254.169.254/latest/meta-data",
                        "timeZone", "America/New_York"
                ))));
        NationalWeatherServiceForecastClient client = new NationalWeatherServiceForecastClient(restTemplate);

        assertThat(client.tryFetchForecast(40.7519, -73.8204)).isNull();
        verify(restTemplate, times(1)).exchange(
                any(RequestEntity.class), any(ParameterizedTypeReference.class));
    }

    private static Map<String, Object> pointsBody() {
        return Map.of("properties", Map.of(
                "forecastHourly", "https://api.weather.gov/gridpoints/OKX/39,45/forecast/hourly",
                "timeZone", "America/New_York"
        ));
    }

    private static Map<String, Object> hourlyBody() {
        return Map.of("properties", Map.of("periods", List.of(period(
                "2026-08-14T17:00:00-04:00", 86, 13.88888888888889, 37, "7 mph", "NW", "Mostly Sunny"
        ), period(
                "2026-08-14T18:00:00-04:00", 85, 15.0, 42, "8 mph", "W", "Partly Cloudy"
        ))));
    }

    private static Map<String, Object> period(String startTime,
                                              int temperatureF,
                                              double dewPointC,
                                              int humidity,
                                              String windSpeed,
                                              String windDirection,
                                              String shortForecast) {
        return Map.of(
                "startTime", startTime,
                "isDaytime", true,
                "temperature", temperatureF,
                "temperatureUnit", "F",
                "dewpoint", Map.of("unitCode", "wmoUnit:degC", "value", dewPointC),
                "relativeHumidity", Map.of("unitCode", "wmoUnit:percent", "value", humidity),
                "windSpeed", windSpeed,
                "windDirection", windDirection,
                "shortForecast", shortForecast
        );
    }
}
