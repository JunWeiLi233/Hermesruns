package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AcclimatizationService {
    private static final Logger log = LoggerFactory.getLogger(AcclimatizationService.class);

    private static final double DEFAULT_BASELINE_DEW_POINT_C = 15.0;
    private static final double SHOCK_DELTA_THRESHOLD_C = 4.0;

    /*
     * Pace-penalty coefficients calibrated against published heat-and-running research:
     *  - Maughan / Galloway dew-point pace-impact tables and the Runner's World
     *    adjusted-pace calculator: measurable impact begins ~13°C dew point.
     *  - Cheuvront et al. (2010) endurance decrement: ~2 % per 5 °C above the
     *    runner's acclimatization baseline.
     *  - Roecker et al. (2013) marathon-finish-time analysis: ~0.3 % per °C
     *    above 10 °C ambient.
     *
     * For a typical 5:00 /km (300 s/km) easy pace, 2 s/km per °C ≈ 0.66 %/°C —
     * inside the published 0.3–1.0 %/°C band. The previous 12 s/km/°C value
     * implied a ~4 %/°C decrement, which is roughly 4× the highest published
     * estimate and produced 2:00+/km penalties at 25 °C dew point.
     */
    private static final double PENALTY_TRIGGER_DEW_POINT_C = 13.0;
    private static final double BASE_PENALTY_SEC_PER_KM_PER_DEGREE = 2.0;
    private static final int MAX_PENALTY_SEC_PER_KM = 30;
    private static final double SAFETY_WARNING_DEW_POINT_C = 26.0;

    private static final Duration DEW_POINT_CACHE_TTL = Duration.ofHours(24);
    private static final Duration CURRENT_DEW_POINT_CACHE_TTL = Duration.ofMinutes(30);
    private static final String OPEN_METEO_ENDPOINT = "archive";

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RestTemplate restTemplate;
    private final TtlCacheStore cacheStore;
    private final OpenMeteoRateLimiter rateLimiter;

    @Autowired
    public AcclimatizationService(ActivityRepository activityRepository,
                                  ActivityPointRepository activityPointRepository,
                                  RestTemplate restTemplate,
                                  TtlCacheStore cacheStore,
                                  OpenMeteoRateLimiter rateLimiter) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.restTemplate = restTemplate;
        this.cacheStore = cacheStore;
        this.rateLimiter = rateLimiter;
    }

    public AcclimatizationService(ActivityRepository activityRepository,
                                  ActivityPointRepository activityPointRepository,
                                  RestTemplate restTemplate) {
        this(activityRepository, activityPointRepository, restTemplate,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()),
                new OpenMeteoRateLimiter());
    }

    public WeatherContextResponse buildContext(Runner runner) {
        return buildContextForDate(runner, LocalDate.now());
    }

    public WeatherContextResponse buildContext(Runner runner, Double latitude, Double longitude) {
        return buildContextForDate(runner, LocalDate.now(), latitude, longitude);
    }

    public WeatherContextResponse buildContextForDate(Runner runner, LocalDate targetDate) {
        return buildContextForDate(runner, targetDate, null, null);
    }

    public WeatherContextResponse buildContextForDate(
            Runner runner,
            LocalDate targetDate,
            Double requestedLatitude,
            Double requestedLongitude
    ) {
        LocalDate lookbackStart = targetDate.minusDays(14);
        LocalDateTime lookbackStartDateTime = lookbackStart.atStartOfDay();

        WeatherCoordinates coordinates = resolveCoordinates(runner, requestedLatitude, requestedLongitude);
        if (coordinates == null) {
            return WeatherContextResponse.unavailable("No recent run GPS points found.");
        }

        double lat = coordinates.latitude();
        double lon = coordinates.longitude();

        List<Activity> recentRuns = activityRepository.findRunsBetween(
                runner, ActivityType.RUN, lookbackStartDateTime, targetDate.plusDays(1).atStartOfDay()
        );

        Set<LocalDate> runDates = new HashSet<>();
        for (Activity activity : recentRuns) {
            LocalDate d = resolveActivityDate(activity);
            if (d != null && !d.isBefore(lookbackStart) && !d.isAfter(targetDate)) {
                runDates.add(d);
            }
        }

        DewPointSeries series = fetchDewPointSeries(lat, lon, lookbackStart, targetDate);
        if (series == null || series.dailyDewPointC().isEmpty()) {
            return WeatherContextResponse.unavailableAtCoordinates(
                    lat,
                    lon,
                    "Weather provider returned no dew point data."
            );
        }

        double baselineDewPoint = computeBaseline(series.dailyDewPointC(), runDates);
        double currentDewPoint = series.dailyDewPointC().getOrDefault(targetDate, baselineDewPoint);

        double shockDelta = currentDewPoint - baselineDewPoint;
        boolean shockEvent = shockDelta >= SHOCK_DELTA_THRESHOLD_C;

        int fullPenalty = (int) Math.max(
                0,
                Math.round((currentDewPoint - PENALTY_TRIGGER_DEW_POINT_C) * BASE_PENALTY_SEC_PER_KM_PER_DEGREE)
        );
        fullPenalty = Math.min(fullPenalty, MAX_PENALTY_SEC_PER_KM);

        AcclimatizationProgress progress = computeProgress(series.dailyDewPointC(), targetDate);
        int adjustedPenalty = (int) Math.round(fullPenalty * progress.penaltyFactor());

        String message = null;
        if (adjustedPenalty > 0) {
            if (currentDewPoint >= SAFETY_WARNING_DEW_POINT_C) {
                message = "Dew point " + round2(currentDewPoint) + "°C — extreme heat stress."
                        + " Easy pace +" + adjustedPenalty + "s/km today."
                        + " Consider moving the workout earlier or doing intervals indoors.";
            } else {
                message = "Dew point " + round2(currentDewPoint) + "°C (above your "
                        + round2(baselineDewPoint) + "°C baseline). Easy pace +" + adjustedPenalty
                        + "s/km today. The adjustment fades over 7-10 days as you acclimatize.";
            }
        }

        return new WeatherContextResponse(
                true,
                lat,
                lon,
                round2(currentDewPoint),
                round2(baselineDewPoint),
                round2(shockDelta),
                shockEvent,
                SHOCK_DELTA_THRESHOLD_C,
                adjustedPenalty,
                progress.dayIndex(),
                progress.penaltyFactor(),
                progress.status(),
                message
        );
    }

    private WeatherCoordinates resolveCoordinates(Runner runner, Double requestedLatitude, Double requestedLongitude) {
        if (requestedLatitude != null || requestedLongitude != null) {
            return isValidGpsCoordinate(requestedLatitude, requestedLongitude)
                    ? new WeatherCoordinates(requestedLatitude, requestedLongitude)
                    : null;
        }

        List<Object[]> latestLatLng = activityPointRepository.findLatestLatLngByRunnerAndType(
                runner.getId(), ActivityType.RUN.name()
        );
        if (latestLatLng == null || latestLatLng.isEmpty()) return null;

        Object[] latestCoordinate = latestLatLng.get(0);
        if (latestCoordinate == null || latestCoordinate.length < 2
                || !(latestCoordinate[0] instanceof Number latitudeValue)
                || !(latestCoordinate[1] instanceof Number longitudeValue)) {
            return null;
        }

        Double latitude = latitudeValue.doubleValue();
        Double longitude = longitudeValue.doubleValue();
        return isValidGpsCoordinate(latitude, longitude)
                ? new WeatherCoordinates(latitude, longitude)
                : null;
    }

    private boolean isValidGpsCoordinate(Double latitude, Double longitude) {
        return latitude != null
                && longitude != null
                && Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && longitude >= -180.0
                && longitude <= 180.0;
    }

    public Integer calculatePenaltyForActivity(Activity activity) {
        if (activity.getRunner() == null) return 0;
        LocalDate runDate = resolveActivityDate(activity);
        if (runDate == null) return 0;

        // Use buildContextForDate to get the penalty
        WeatherContextResponse context = buildContextForDate(activity.getRunner(), runDate);
        return context.available() ? context.pacePenaltySecPerKm() : 0;
    }

    private DewPointSeries fetchDewPointSeries(double lat, double lon, LocalDate start, LocalDate end) {
        String cacheKey = dewPointCacheKey(lat, lon, start, end);
        DewPointSeriesCache cached = cacheStore.get("open-meteo-dew-point", cacheKey, DewPointSeriesCache.class).orElse(null);
        if (cached != null) {
            return cached.toSeries();
        }

        LocalDate today = LocalDate.now();
        LocalDate archiveEnd = end.isBefore(today) ? end : today.minusDays(1);
        Map<LocalDate, Double> values = new HashMap<>();

        if (!archiveEnd.isBefore(start)) {
            if (rateLimiter.shouldThrottle(OPEN_METEO_ENDPOINT)) {
                log.debug("Open-Meteo archive API is currently throttled; skipping dew-point fetch for ({}, {})", lat, lon);
                return null;
            }

            URI archiveUri = UriComponentsBuilder
                    .fromUriString("https://archive-api.open-meteo.com/v1/archive")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("start_date", start)
                    .queryParam("end_date", archiveEnd)
                    .queryParam("daily", "dew_point_2m_mean")
                    .queryParam("timezone", "auto")
                    .build()
                    .toUri();

            try {
                RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, archiveUri);
                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                        request,
                        new ParameterizedTypeReference<>() {}
                );
                rateLimiter.recordSuccess(OPEN_METEO_ENDPOINT);
                appendDailyDewPoints(response.getBody(), values);
            } catch (HttpClientErrorException e) {
                if (e.getStatusCode().value() == 429) {
                    rateLimiter.recordRateLimited(OPEN_METEO_ENDPOINT);
                    log.warn("Open-Meteo archive API returned 429 Too Many Requests; subsequent calls in this window are throttled.");
                } else {
                    log.warn("Open-Meteo archive API returned HTTP {}: {}", e.getStatusCode().value(), e.getMessage());
                }
                return null;
            } catch (Exception e) {
                log.warn("Open-Meteo archive API call failed: {}", e.getMessage());
                return null;
            }
        }

        if (end.equals(today)) {
            Double currentDewPoint = fetchCurrentDewPoint(lat, lon);
            if (currentDewPoint != null) {
                values.put(end, currentDewPoint);
            }
        }

        if (values.isEmpty()) {
            return null;
        }

        DewPointSeries series = new DewPointSeries(values);
        Duration cacheTtl = end.equals(today) ? CURRENT_DEW_POINT_CACHE_TTL : DEW_POINT_CACHE_TTL;
        cacheStore.put("open-meteo-dew-point", cacheKey, DewPointSeriesCache.from(series), cacheTtl);
        return series;
    }

    private void appendDailyDewPoints(Map<String, Object> body, Map<LocalDate, Double> values) {
        if (body == null || !(body.get("daily") instanceof Map<?, ?> daily)) return;

        Object timesObj = daily.get("time");
        Object dewObj = daily.get("dew_point_2m_mean");
        if (!(timesObj instanceof List<?> times) || !(dewObj instanceof List<?> dews)) return;

        int count = Math.min(times.size(), dews.size());
        for (int index = 0; index < count; index++) {
            Object time = times.get(index);
            Object dewPoint = dews.get(index);
            if (!(time instanceof String date) || !(dewPoint instanceof Number numericDewPoint)) continue;
            values.put(LocalDate.parse(date), numericDewPoint.doubleValue());
        }
    }

    private Double fetchCurrentDewPoint(double latitude, double longitude) {
        URI uri = UriComponentsBuilder
                .fromUriString("https://api.open-meteo.com/v1/forecast")
                .queryParam("latitude", latitude)
                .queryParam("longitude", longitude)
                .queryParam("current", "dew_point_2m")
                .queryParam("timezone", "auto")
                .build()
                .toUri();

        try {
            RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    request,
                    new ParameterizedTypeReference<>() {}
            );
            Map<String, Object> body = response.getBody();
            if (body == null || !(body.get("current") instanceof Map<?, ?> current)) return null;
            Object dewPoint = current.get("dew_point_2m");
            return dewPoint instanceof Number numericDewPoint ? numericDewPoint.doubleValue() : null;
        } catch (Exception exception) {
            log.warn("Open-Meteo forecast API dew-point call failed: {}", exception.getMessage());
            return null;
        }
    }

    private String dewPointCacheKey(double lat, double lon, LocalDate start, LocalDate end) {
        // Round to 2 decimal places (~1.1 km) so normal GPS jitter between runs
        // doesn't bust the 24-hour cache and trigger a fresh archive API call.
        return String.format(Locale.ROOT, "%.2f|%.2f|%s|%s", lat, lon, start, end);
    }

    private double computeBaseline(Map<LocalDate, Double> series, Set<LocalDate> runDates) {
        List<Double> exposure = new ArrayList<>();
        for (LocalDate d : runDates) {
            Double dew = series.get(d);
            if (dew != null && Double.isFinite(dew)) {
                exposure.add(dew);
            }
        }
        if (exposure.isEmpty()) {
            for (Double v : series.values()) {
                if (v != null && Double.isFinite(v)) exposure.add(v);
            }
        }
        if (exposure.isEmpty()) return DEFAULT_BASELINE_DEW_POINT_C;
        return exposure.stream().mapToDouble(Double::doubleValue).average().orElse(DEFAULT_BASELINE_DEW_POINT_C);
    }

    private AcclimatizationProgress computeProgress(Map<LocalDate, Double> series, LocalDate today) {
        LocalDate hotStart = null;
        for (int i = 0; i <= 13; i++) {
            LocalDate d = today.minusDays(i);
            Double dew = series.get(d);
            if (dew != null && dew > PENALTY_TRIGGER_DEW_POINT_C) {
                hotStart = d;
            }
        }
        if (hotStart == null) {
            return new AcclimatizationProgress(1, 1.0, "day_1_3");
        }

        int dayIndex = (int) ChronoUnit.DAYS.between(hotStart, today) + 1;
        dayIndex = Math.max(1, Math.min(14, dayIndex));

        if (dayIndex <= 3) {
            return new AcclimatizationProgress(dayIndex, 1.0, "day_1_3");
        }
        if (dayIndex <= 9) {
            double ratio = (dayIndex - 3) / 6.0;
            double factor = 1.0 - ratio;
            return new AcclimatizationProgress(dayIndex, Math.max(0.0, factor), "day_4_9");
        }
        return new AcclimatizationProgress(dayIndex, 0.0, "day_10_14");
    }

    private LocalDate resolveActivityDate(Activity activity) {
        if (activity.getStartTime() != null) return activity.getStartTime().toLocalDate();
        if (activity.getStartDate() != null && !activity.getStartDate().isBlank()) {
            try {
                String value = activity.getStartDate();
                if (value.length() >= 10) {
                    return LocalDate.parse(value.substring(0, 10));
                }
            } catch (Exception ignored) {
            }
        }
        if (activity.getCreatedAt() != null) return activity.getCreatedAt().toLocalDate();
        return null;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record DewPointSeries(Map<LocalDate, Double> dailyDewPointC) {}

    private record WeatherCoordinates(double latitude, double longitude) {}

    private record DewPointSeriesCache(Map<String, Double> dailyDewPointC) {
        private static DewPointSeriesCache from(DewPointSeries series) {
            Map<String, Double> values = new LinkedHashMap<>();
            for (Map.Entry<LocalDate, Double> entry : series.dailyDewPointC().entrySet()) {
                values.put(entry.getKey().toString(), entry.getValue());
            }
            return new DewPointSeriesCache(values);
        }

        private DewPointSeries toSeries() {
            Map<LocalDate, Double> values = new HashMap<>();
            if (dailyDewPointC != null) {
                for (Map.Entry<String, Double> entry : dailyDewPointC.entrySet()) {
                    values.put(LocalDate.parse(entry.getKey()), entry.getValue());
                }
            }
            return new DewPointSeries(values);
        }
    }

    private record AcclimatizationProgress(int dayIndex, double penaltyFactor, String status) {}

    public record WeatherContextResponse(
            boolean available,
            Double latitude,
            Double longitude,
            Double currentDewPointC,
            Double baselineDewPoint14dC,
            Double climateShockDeltaC,
            boolean climateShockEvent,
            Double climateShockThresholdC,
            Integer pacePenaltySecPerKm,
            Integer acclimatizationDay,
            Double penaltyFactor,
            String acclimatizationStatus,
            String message
    ) {
        static WeatherContextResponse unavailable(String message) {
            return unavailable(null, null, message);
        }

        static WeatherContextResponse unavailableAtCoordinates(double latitude, double longitude, String message) {
            return unavailable(latitude, longitude, message);
        }

        private static WeatherContextResponse unavailable(Double latitude, Double longitude, String message) {
            return new WeatherContextResponse(
                    false,
                    latitude,
                    longitude,
                    null,
                    null,
                    null,
                    false,
                    SHOCK_DELTA_THRESHOLD_C,
                    0,
                    null,
                    null,
                    null,
                    message
            );
        }
    }
}
