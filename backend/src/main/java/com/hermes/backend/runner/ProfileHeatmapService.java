package com.hermes.backend.runner;

import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.imports.ActivityNormalizationService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.ProfileModels.HeatPoint;
import com.hermes.backend.runner.ProfileModels.HeatmapBounds;
import com.hermes.backend.runner.ProfileModels.HeatmapDiagnostics;
import com.hermes.backend.runner.ProfileModels.HeatmapPage;
import com.hermes.backend.runner.ProfileModels.HeatmapResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ProfileHeatmapService {
    private static final Duration HEATMAP_CACHE_TTL = Duration.ofMinutes(5);
    private static final int DEFAULT_HEATMAP_PAGE_LIMIT = 50000;
    private static final int DEFAULT_HEATMAP_COVERAGE_LIMIT = 60000;
    private static final int MAX_HEATMAP_PAGE_LIMIT = 100000;
    // Sampled render pool: the heatmap draws at most ~12k dots, so the sample
    // mode returns one bounded, strided pool (25k points) instead of letting
    // clients page through the full multi-million-point history (~75MB JSON
    // observed in production, all parsed and cached on the main thread).
    private static final int DEFAULT_HEATMAP_SAMPLE_LIMIT = 25000;
    // Bounds come from a strided coordinate sample with tail trimming instead of
    // a raw SQL min/max: a single stray GPS reading (import glitch, dropped-fix
    // point) used to stretch the map across the planet and pin the heatmap at
    // world zoom, which looked broken and made every redraw project the full
    // point pool.
    private static final int HEATMAP_BOUNDS_SAMPLE_LIMIT = 20000;
    private static final int HEATMAP_BOUNDS_MIN_SAMPLES_FOR_TRIM = 50;
    private static final double HEATMAP_BOUNDS_TRIM_FRACTION = 0.02;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final ActivityNormalizationService activityNormalizationService;
    private final TtlCacheStore cacheStore;

    public ProfileHeatmapService(
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            TtlCacheStore cacheStore
    ) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.activityNormalizationService = activityNormalizationService;
        this.cacheStore = cacheStore;
    }

    public HeatmapResponse heatmap(Runner runner, Long offset, Integer limit, Boolean coverage, Boolean sample) {
        if (activityRepository.existsByRunnerAndActivityTypeIsNull(runner)) {
            activityNormalizationService.backfillActivityTypes(runner);
        }

        String heatmapCacheKey = HeatmapCacheKey.forRunner(runner.getId());

        long activityCount = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        if (activityCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, 0, null, new HeatmapDiagnostics(0, 0, 0, true), null);
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return response;
        }

        long sourcePointCount = activityPointRepository.countHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        if (sourcePointCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, activityCount, null, new HeatmapDiagnostics(0, 0, 0, true), null);
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return response;
        }

        if (Boolean.TRUE.equals(sample)) {
            HeatmapResponse cachedSample = cacheStore.get(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, HeatmapResponse.class).orElse(null);
            if (isCompleteHeatmapResponse(cachedSample, sourcePointCount)) {
                return cachedSample;
            }
            // One bounded query serves both the render pool and the trimmed
            // bounds; the stride covers the entire ordered dataset by
            // construction, so the response is final (nothing left to fetch)
            // even though it carries only a sample of the GPS history.
            int safeLimit = Math.max(1, Math.min(MAX_HEATMAP_PAGE_LIMIT, limit == null ? DEFAULT_HEATMAP_SAMPLE_LIMIT : limit));
            int stride = Math.max(1, (int) Math.ceil(sourcePointCount * 1.0 / safeLimit));
            List<Object[]> sampleRows = activityPointRepository.findHeatmapCoveragePointsByRunnerAndType(
                    runner.getId(),
                    ActivityType.RUN.name(),
                    stride,
                    safeLimit
            );
            HeatmapBounds sampledBounds = buildRobustBoundsFromSamples(sampleRows);
            List<Object[]> validActivityPoints = filterValidHeatmapRows(sampleRows);
            List<HeatPoint> points = buildHeatPoints(validActivityPoints);
            HeatmapResponse response = new HeatmapResponse(
                    points,
                    sourcePointCount,
                    points.size(),
                    activityCount,
                    sampledBounds,
                    new HeatmapDiagnostics(sourcePointCount, sampleRows.size(), points.size(), true),
                    null
            );
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return response;
        }

        int boundsStride = Math.max(1, (int) Math.ceil(sourcePointCount * 1.0 / HEATMAP_BOUNDS_SAMPLE_LIMIT));
        HeatmapBounds bounds = buildRobustBoundsFromSamples(activityPointRepository.findHeatmapCoveragePointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name(),
                boundsStride,
                HEATMAP_BOUNDS_SAMPLE_LIMIT
        ));

        if (Boolean.TRUE.equals(coverage)) {
            int safeLimit = Math.max(1, Math.min(MAX_HEATMAP_PAGE_LIMIT, limit == null ? DEFAULT_HEATMAP_COVERAGE_LIMIT : limit));
            int stride = Math.max(1, (int) Math.ceil(sourcePointCount * 1.0 / safeLimit));
            List<Object[]> activityPoints = activityPointRepository.findHeatmapCoveragePointsByRunnerAndType(
                    runner.getId(),
                    ActivityType.RUN.name(),
                    stride,
                    safeLimit
            );
            List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
            List<HeatPoint> points = buildHeatPoints(validActivityPoints);
            HeatmapResponse response = new HeatmapResponse(
                    points,
                    sourcePointCount,
                    points.size(),
                    activityCount,
                    bounds,
                    new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), points.size() >= sourcePointCount),
                    new HeatmapPage(0L, safeLimit, points.size(), points.size() < sourcePointCount)
            );
            return response;
        }

        if (offset != null || limit != null) {
            long safeOffset = Math.max(0L, offset == null ? 0L : offset);
            int safeLimit = Math.max(1, Math.min(MAX_HEATMAP_PAGE_LIMIT, limit == null ? DEFAULT_HEATMAP_PAGE_LIMIT : limit));
            List<Object[]> activityPoints = activityPointRepository.findHeatmapPointsPageByRunnerAndType(
                    runner.getId(),
                    ActivityType.RUN.name(),
                    safeLimit,
                    safeOffset
            );
            List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
            List<HeatPoint> points = buildHeatPoints(validActivityPoints);
            HeatmapResponse response = new HeatmapResponse(
                    points,
                    sourcePointCount,
                    points.size(),
                    activityCount,
                    bounds,
                    new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), safeOffset + points.size() >= sourcePointCount),
                    new HeatmapPage(safeOffset, safeLimit, points.size(), safeOffset + points.size() < sourcePointCount)
            );
            return response;
        }

        HeatmapResponse cached = cacheStore.get(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, HeatmapResponse.class).orElse(null);
        if (isCompleteHeatmapResponse(cached, sourcePointCount)) {
            return cached;
        }
        if (cached != null) {
            cacheStore.evict(HeatmapCacheKey.NAMESPACE, heatmapCacheKey);
        }

        List<Object[]> activityPoints = activityPointRepository.findAllHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
        List<HeatPoint> points = buildHeatPoints(validActivityPoints);

        HeatmapResponse response = new HeatmapResponse(
                points,
                sourcePointCount,
                points.size(),
                activityCount,
                bounds,
                new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), points.size() == sourcePointCount),
                null
        );
        if (isCompleteHeatmapResponse(response, sourcePointCount)) {
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
        } else {
            cacheStore.evict(HeatmapCacheKey.NAMESPACE, heatmapCacheKey);
        }
        return response;
    }

    private HeatmapBounds buildRobustBoundsFromSamples(List<Object[]> points) {
        if (points == null || points.isEmpty()) {
            return null;
        }

        List<Double> latitudes = new ArrayList<>();
        List<Double> longitudes = new ArrayList<>();
        for (Object[] point : points) {
            Double lat = toNullableDouble(point[1]);
            Double lng = toNullableDouble(point[2]);
            if (!isValidGpsCoordinate(lat, lng)) {
                continue;
            }
            latitudes.add(lat);
            longitudes.add(lng);
        }

        if (latitudes.isEmpty()) {
            return null;
        }

        return new HeatmapBounds(
                trimmedEdge(latitudes, true),
                trimmedEdge(longitudes, true),
                trimmedEdge(latitudes, false),
                trimmedEdge(longitudes, false)
        );
    }

    /**
     * Edge of the coordinate distribution after dropping the outer
     * HEATMAP_BOUNDS_TRIM_FRACTION of samples on the requested side. Small
     * samples (a brand-new account, a single short run) keep plain min/max —
     * with too few points there is no majority to defend.
     */
    private double trimmedEdge(List<Double> values, boolean lower) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int trim = sorted.size() >= HEATMAP_BOUNDS_MIN_SAMPLES_FOR_TRIM
                ? (int) Math.floor(sorted.size() * HEATMAP_BOUNDS_TRIM_FRACTION)
                : 0;
        return lower ? sorted.get(trim) : sorted.get(sorted.size() - 1 - trim);
    }

    private boolean isCompleteHeatmapResponse(HeatmapResponse response, long sourcePointCount) {
        if (response == null || response.pointCount() != sourcePointCount) {
            return false;
        }
        if (response.points() == null || response.points().size() != response.sampledPointCount()) {
            return false;
        }
        if (response.sampledPointCount() == sourcePointCount) {
            return true;
        }
        // Sampled-final payload: fewer points than the source history, but a
        // stride that covered the whole dataset and no further page to fetch.
        return response.page() == null && response.diagnostics() != null && response.diagnostics().complete();
    }

    private List<Object[]> filterValidHeatmapRows(List<Object[]> activityPoints) {
        if (activityPoints.isEmpty()) {
            return List.of();
        }

        List<Object[]> validRows = new ArrayList<>(activityPoints.size());
        for (Object[] point : activityPoints) {
            if (point == null || point.length < 3) {
                continue;
            }
            if (isValidGpsCoordinate(toNullableDouble(point[1]), toNullableDouble(point[2]))) {
                validRows.add(point);
            }
        }
        return validRows;
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

    private List<HeatPoint> buildHeatPoints(List<Object[]> activityPoints) {
        if (activityPoints.isEmpty()) {
            return List.of();
        }

        List<Double> rawSpeeds = new ArrayList<>();
        Long previousActivityId = null;
        Double previousDistance = null;
        Integer previousElapsed = null;
        Double previousSpeed = null;

        for (Object[] point : activityPoints) {
            Long activityId = toLong(point[0]);
            boolean sameActivity = previousActivityId != null && previousActivityId.equals(activityId);
            if (!sameActivity) {
                previousSpeed = null;
            }
            Double speedMetersPerSecond = extractSegmentSpeed(point, sameActivity, previousDistance, previousElapsed);
            if (speedMetersPerSecond == null) {
                speedMetersPerSecond = previousSpeed;
            } else {
                previousSpeed = speedMetersPerSecond;
            }
            rawSpeeds.add(speedMetersPerSecond);
            previousActivityId = activityId;
            previousDistance = extractPointDistance(point);
            previousElapsed = extractPointElapsed(point);
        }

        List<Double> normalizedSpeeds = new ArrayList<>(rawSpeeds.size());
        for (Double rawSpeed : rawSpeeds) {
            if (rawSpeed != null && rawSpeed > 0) {
                normalizedSpeeds.add(rawSpeed);
            }
        }
        Collections.sort(normalizedSpeeds);
        boolean hasSpeedRange = normalizedSpeeds.size() > 1;
        List<HeatPoint> points = new ArrayList<>(activityPoints.size());

        for (int i = 0; i < activityPoints.size(); i++) {
            Object[] point = activityPoints.get(i);
            Double rawSpeed = rawSpeeds.get(i);
            double speedRatio = hasSpeedRange && rawSpeed != null
                    ? toPercentileRatio(normalizedSpeeds, rawSpeed)
                    : 0.5;
            points.add(new HeatPoint(
                    toLong(point[0]),
                    toNullableDouble(point[1]),
                    toNullableDouble(point[2]),
                    1.0,
                    speedRatio
            ));
        }

        return points;
    }

    private Double extractSegmentSpeed(Object[] point, boolean sameActivity, Double previousDistance, Integer previousElapsed) {
        if (point == null || point.length < 5) {
            return null;
        }
        Double pointDistance = extractPointDistance(point);
        Integer pointElapsed = extractPointElapsed(point);

        if (pointDistance == null || pointElapsed == null || pointElapsed <= 0) {
            return null;
        }
        if (!sameActivity || previousDistance == null || previousElapsed == null) {
            return null;
        }

        double distanceDelta = pointDistance - previousDistance;
        int elapsedDelta = pointElapsed - previousElapsed;

        if (distanceDelta <= 0 || elapsedDelta <= 0) {
            return null;
        }

        return distanceDelta / elapsedDelta;
    }

    private Double extractPointDistance(Object[] point) {
        if (point == null || point.length < 4) {
            return null;
        }
        return point[3] instanceof Number number ? number.doubleValue() : null;
    }

    private Integer extractPointElapsed(Object[] point) {
        if (point == null || point.length < 5) {
            return null;
        }
        return point[4] instanceof Number number ? number.intValue() : null;
    }

    private double toPercentileRatio(List<Double> sortedSpeeds, double rawSpeed) {
        if (sortedSpeeds == null || sortedSpeeds.size() <= 1) {
            return 0.5;
        }

        int insertionIndex = Collections.binarySearch(sortedSpeeds, rawSpeed);
        if (insertionIndex < 0) {
            insertionIndex = -insertionIndex - 1;
        } else {
            while (insertionIndex < sortedSpeeds.size() - 1
                    && Double.compare(sortedSpeeds.get(insertionIndex + 1), rawSpeed) == 0) {
                insertionIndex += 1;
            }
        }

        return clamp((double) insertionIndex / (sortedSpeeds.size() - 1), 0.0, 1.0);
    }

    private Double toNullableDouble(Object value) {
        if (value instanceof Number number) {
            double parsed = number.doubleValue();
            return Double.isFinite(parsed) ? parsed : null;
        }
        if (value instanceof String text) {
            try {
                double parsed = Double.parseDouble(text);
                return Double.isFinite(parsed) ? parsed : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
