package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keyless National Weather Service (weather.gov) forecast fallback used when
 * the primary Open-Meteo provider is throttled or unreachable. Only serves US
 * grid points; the points lookup fails elsewhere and callers treat that as
 * "no fallback available".
 * <p>
 * Responses are converted into the same Open-Meteo forecast payload shape the
 * frontend already consumes: {@code current} plus {@code hourly.time /
 * temperature_2m / weather_code} in degrees Celsius and km/h with WMO weather
 * codes, so the fallback is invisible to the weather page contract.
 * </p>
 */
@Service
public class NationalWeatherServiceForecastClient {
    private static final Logger log = LoggerFactory.getLogger(NationalWeatherServiceForecastClient.class);
    private static final String POINTS_ENDPOINT = "https://api.weather.gov/points/";
    private static final String USER_AGENT = "Hermes/1.0 (personal running coach app)";
    private static final double MPH_TO_KMH = 1.609344;
    private static final double KMH_TO_MS = 1.0 / 3.6;
    private static final Pattern NUMBERS = Pattern.compile("\\d+(?:\\.\\d+)?");
    private static final Map<String, Integer> COMPASS_DEGREES = Map.ofEntries(
            Map.entry("N", 0), Map.entry("NNE", 22), Map.entry("NE", 45), Map.entry("ENE", 67),
            Map.entry("E", 90), Map.entry("ESE", 112), Map.entry("SE", 135), Map.entry("SSE", 157),
            Map.entry("S", 180), Map.entry("SSW", 202), Map.entry("SW", 225), Map.entry("WSW", 247),
            Map.entry("W", 270), Map.entry("WNW", 292), Map.entry("NW", 315), Map.entry("NNW", 337)
    );

    private final RestTemplate restTemplate;

    @Autowired
    public NationalWeatherServiceForecastClient() {
        this(createRestTemplate());
    }

    NationalWeatherServiceForecastClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Fetch and convert an NWS hourly forecast, or return {@code null} when the
     * fallback cannot serve these coordinates right now.
     */
    public Map<String, Object> tryFetchForecast(double latitude, double longitude) {
        try {
            return fetchForecast(latitude, longitude);
        } catch (RestClientException exception) {
            log.debug("NWS fallback forecast unavailable for ({}, {}): {}", latitude, longitude, exception.getMessage());
            return null;
        } catch (Exception exception) {
            log.warn("NWS fallback forecast failed unexpectedly for ({}, {}): {}", latitude, longitude, exception.getMessage());
            return null;
        }
    }

    Map<String, Object> fetchForecast(double latitude, double longitude) {
        String pointsUrl = POINTS_ENDPOINT + String.format(Locale.ROOT, "%.4f,%.4f", latitude, longitude);
        Map<String, Object> points = getJson(pointsUrl);
        if (!(path(points, "properties", "forecastHourly") instanceof String hourlyUrl) || hourlyUrl.isBlank()) {
            throw new IllegalStateException("NWS points response missing forecastHourly URL.");
        }
        Map<String, Object> hourly = getJson(hourlyUrl);
        List<Map<String, Object>> periods = asObjectList(path(hourly, "properties", "periods"));
        if (periods.isEmpty()) {
            throw new IllegalStateException("NWS hourly response missing periods.");
        }

        List<Map<String, Object>> window = periods.subList(0, Math.min(12, periods.size()));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("current", buildCurrent(window.get(0)));
        payload.put("hourly", buildHourly(window));
        payload.put("timezone", path(points, "properties", "timeZone"));
        return payload;
    }

    private Map<String, Object> getJson(String url) {
        RequestEntity<Void> request = RequestEntity.get(java.net.URI.create(url))
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/geo+json")
                .build();
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                request,
                new ParameterizedTypeReference<>() {}
        );
        Map<String, Object> body = response.getBody();
        if (body == null) {
            throw new IllegalStateException("NWS response body was empty.");
        }
        return body;
    }

    private Map<String, Object> buildCurrent(Map<String, Object> period) {
        Double temperature = temperatureCelsius(period);
        Double humidity = nestedNumber(period.get("relativeHumidity"));
        Double dewPoint = nestedNumber(period.get("dewpoint"));
        Double windKmh = windSpeedKmh(asText(period.get("windSpeed")));

        Map<String, Object> current = new LinkedHashMap<>();
        current.put("time", naiveLocalTime(asText(period.get("startTime"))));
        current.put("temperature_2m", temperature);
        current.put("apparent_temperature", apparentTemperatureCelsius(temperature, humidity, windKmh));
        current.put("dew_point_2m", dewPoint);
        current.put("relative_humidity_2m", humidity);
        current.put("wind_speed_10m", windKmh);
        current.put("wind_direction_10m", compassDegrees(asText(period.get("windDirection"))));
        current.put("weather_code", weatherCode(asText(period.get("shortForecast"))));
        return current;
    }

    private Map<String, Object> buildHourly(List<Map<String, Object>> periods) {
        List<String> times = new ArrayList<>();
        List<Double> temperatures = new ArrayList<>();
        List<Integer> codes = new ArrayList<>();
        for (Map<String, Object> period : periods) {
            times.add(naiveLocalTime(asText(period.get("startTime"))));
            temperatures.add(temperatureCelsius(period));
            codes.add(weatherCode(asText(period.get("shortForecast"))));
        }
        Map<String, Object> hourly = new LinkedHashMap<>();
        hourly.put("time", times);
        hourly.put("temperature_2m", temperatures);
        hourly.put("weather_code", codes);
        return hourly;
    }

    private static Object path(Map<String, Object> body, String... keys) {
        Object value = body;
        for (String key : keys) {
            if (!(value instanceof Map<?, ?> map)) return null;
            value = map.get(key);
        }
        return value;
    }

    private static List<Map<String, Object>> asObjectList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Map<String, Object>> objects = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> cast = (Map<String, Object>) map;
                objects.add(cast);
            }
        }
        return objects;
    }

    private static String asText(Object value) {
        return value instanceof String text ? text : null;
    }

    private static Double nestedNumber(Object unitValue) {
        if (!(unitValue instanceof Map<?, ?> unit) || !(unit.get("value") instanceof Number number)) {
            return null;
        }
        return number.doubleValue();
    }

    private static Double temperatureCelsius(Map<String, Object> period) {
        if (!(period.get("temperature") instanceof Number number)) return null;
        String unit = asText(period.get("temperatureUnit"));
        if ("F".equalsIgnoreCase(unit)) {
            return (number.doubleValue() - 32.0) * 5.0 / 9.0;
        }
        return number.doubleValue();
    }

    private static Double windSpeedKmh(String nwsSpeed) {
        if (nwsSpeed == null) return null;
        Matcher matcher = NUMBERS.matcher(nwsSpeed);
        double total = 0.0;
        int count = 0;
        while (matcher.find()) {
            total += Double.parseDouble(matcher.group());
            count++;
        }
        return count == 0 ? null : total / count * MPH_TO_KMH;
    }

    /**
     * Australian BOM apparent temperature: AT = T + 0.33e - 0.70ws - 4.00 with
     * vapor pressure e in hPa and wind speed ws in m/s.
     */
    private static Double apparentTemperatureCelsius(Double temperatureC, Double humidityPercent, Double windKmh) {
        if (temperatureC == null) return null;
        if (humidityPercent == null || windKmh == null) return temperatureC;
        double vaporPressure = humidityPercent / 100.0 * 6.105 * Math.exp(17.27 * temperatureC / (237.7 + temperatureC));
        return temperatureC + 0.33 * vaporPressure - 0.70 * (windKmh * KMH_TO_MS) - 4.00;
    }

    private static Integer compassDegrees(String direction) {
        if (direction == null) return null;
        return COMPASS_DEGREES.get(direction.trim().toUpperCase(Locale.ROOT));
    }

    /**
     * Map NWS shortForecast text into the WMO weather codes the frontend's
     * describeWeatherCode buckets already understand.
     */
    private static Integer weatherCode(String shortForecast) {
        if (shortForecast == null) return null;
        String text = shortForecast.toLowerCase(Locale.ROOT);
        if (text.contains("thunder")) return 95;
        if (text.contains("snow") || text.contains("blizzard")) return 71;
        if (text.contains("sleet") || text.contains("ice") || text.contains("freezing")) return 66;
        if (text.contains("drizzle")) return 51;
        if (text.contains("shower")) return 80;
        if (text.contains("rain")) return 63;
        if (text.contains("fog") || text.contains("haze")) return 45;
        if (text.contains("mostly sunny") || text.contains("mostly clear")) return 1;
        if (text.contains("partly")) return 2;
        if (text.contains("clear") || text.contains("sunny")) return 0;
        if (text.contains("cloudy") || text.contains("clouds")) return 3;
        return 3;
    }

    /**
     * Open-Meteo (timezone=auto) emits location-local naive timestamps like
     * "2026-08-14T17:00"; strip NWS's UTC offset to keep the same shape.
     */
    private static String naiveLocalTime(String isoTime) {
        if (isoTime == null || isoTime.length() < 16) return null;
        return isoTime.substring(0, 16);
    }

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2_000);
        factory.setReadTimeout(5_000);
        return new RestTemplate(factory);
    }
}
