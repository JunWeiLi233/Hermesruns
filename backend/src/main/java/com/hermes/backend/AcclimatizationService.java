package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AcclimatizationService {
    private static final double DEFAULT_BASELINE_DEW_POINT_C = 15.0;
    private static final double SHOCK_DELTA_THRESHOLD_C = 4.0;
    private static final double PENALTY_TRIGGER_DEW_POINT_C = 15.0;
    private static final int BASE_PENALTY_SEC_PER_KM_PER_DEGREE = 12;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RestTemplate restTemplate;

    public AcclimatizationService(ActivityRepository activityRepository,
                                  ActivityPointRepository activityPointRepository,
                                  RestTemplate restTemplate) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.restTemplate = restTemplate;
    }

    public WeatherContextResponse buildContext(Runner runner) {
        LocalDate today = LocalDate.now();
        LocalDate lookbackStart = today.minusDays(14);
        LocalDateTime lookbackStartDateTime = lookbackStart.atStartOfDay();

        List<Object[]> latestLatLng = activityPointRepository.findLatestLatLngByRunnerAndType(runner.getId(), ActivityType.RUN.name());
        if (latestLatLng.isEmpty()) {
            return WeatherContextResponse.unavailable("No recent run GPS points found.");
        }

        double lat = ((Number) latestLatLng.get(0)[0]).doubleValue();
        double lon = ((Number) latestLatLng.get(0)[1]).doubleValue();

        List<Activity> recentRuns = activityRepository.findRunsBetween(
                runner, ActivityType.RUN, lookbackStartDateTime, today.plusDays(1).atStartOfDay()
        );

        Set<LocalDate> runDates = new HashSet<>();
        for (Activity activity : recentRuns) {
            LocalDate d = resolveActivityDate(activity);
            if (d != null && !d.isBefore(lookbackStart) && !d.isAfter(today)) {
                runDates.add(d);
            }
        }

        DewPointSeries series = fetchDewPointSeries(lat, lon, lookbackStart, today);
        if (series == null || series.dailyDewPointC().isEmpty()) {
            return WeatherContextResponse.unavailable("Weather provider returned no dew point data.");
        }

        double baselineDewPoint = computeBaseline(series.dailyDewPointC(), runDates);
        double currentDewPoint = series.dailyDewPointC().getOrDefault(today, baselineDewPoint);

        double shockDelta = currentDewPoint - baselineDewPoint;
        boolean shockEvent = shockDelta >= SHOCK_DELTA_THRESHOLD_C;

        int fullPenalty = (int) Math.max(
                0,
                Math.round((currentDewPoint - PENALTY_TRIGGER_DEW_POINT_C) * BASE_PENALTY_SEC_PER_KM_PER_DEGREE)
        );

        AcclimatizationProgress progress = computeProgress(series.dailyDewPointC(), today);
        int adjustedPenalty = (int) Math.round(fullPenalty * progress.penaltyFactor());

        String message = null;
        if (adjustedPenalty > 0) {
            message = "Extreme Heat Detected. We've adjusted your target pace by +" + adjustedPenalty
                    + " sec/km today to account for humidity. This should help keep you in the right zone."
                    + " The adjustment will fade as acclimatization improves.";
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

    private DewPointSeries fetchDewPointSeries(double lat, double lon, LocalDate start, LocalDate end) {
        URI uri = UriComponentsBuilder
                .fromUriString("https://archive-api.open-meteo.com/v1/archive")
                .queryParam("latitude", lat)
                .queryParam("longitude", lon)
                .queryParam("start_date", start)
                .queryParam("end_date", end)
                .queryParam("daily", "dew_point_2m_mean")
                .queryParam("timezone", "auto")
                .build()
                .toUri();

        RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                request,
                new ParameterizedTypeReference<>() {}
        );

        Map<String, Object> body = response.getBody();
        if (body == null || !(body.get("daily") instanceof Map<?, ?> daily)) {
            return null;
        }

        Object timesObj = daily.get("time");
        Object dewObj = daily.get("dew_point_2m_mean");
        if (!(timesObj instanceof List<?> times) || !(dewObj instanceof List<?> dews) || times.isEmpty()) {
            return null;
        }

        Map<LocalDate, Double> out = new HashMap<>();
        int n = Math.min(times.size(), dews.size());
        for (int i = 0; i < n; i++) {
            Object t = times.get(i);
            Object d = dews.get(i);
            if (!(t instanceof String ts) || !(d instanceof Number dew)) continue;
            out.put(LocalDate.parse(ts), dew.doubleValue());
        }
        return new DewPointSeries(out);
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
            return new WeatherContextResponse(
                    false,
                    null,
                    null,
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
