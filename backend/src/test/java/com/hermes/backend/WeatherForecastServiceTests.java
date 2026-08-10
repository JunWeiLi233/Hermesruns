package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WeatherForecastServiceTests {

    @Test
    void fetchForecastUsesFixedOpenMeteoEndpointAndExpectedFields() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        Map<String, Object> payload = Map.of("current", Map.of("temperature_2m", 21.5));
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(payload));
        WeatherForecastService service = new WeatherForecastService(restTemplate);

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
    }
}
