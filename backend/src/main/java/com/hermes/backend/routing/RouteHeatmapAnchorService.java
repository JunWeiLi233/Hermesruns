package com.hermes.backend.routing;

import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class RouteHeatmapAnchorService {

    private static final Duration ANCHOR_CACHE_TTL = Duration.ofMinutes(15);
    private static final String ANCHOR_CACHE_NAMESPACE = "route-anchor-density-v2";

    private static final double CELL_DEGREES = 0.001;

    private final ActivityPointRepository activityPointRepository;
    private final TtlCacheStore cacheStore;

    public String sourceRevision(Long runnerId) {
        return cacheStore.get("route-source-revision", runnerId.toString(), String.class).orElse("");
    }

    @org.springframework.transaction.event.TransactionalEventListener(phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void runIngested(com.hermes.backend.activity.ActivityIngestedEvent event) {
        invalidate(event.runnerId());
    }

    @org.springframework.transaction.event.TransactionalEventListener(phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void pointsStored(com.hermes.backend.activity.ActivityPointsStoredEvent event) {
        invalidate(event.runnerId());
    }

    private void invalidate(Long runnerId) {
        if (runnerId == null) return;
        cacheStore.evict(ANCHOR_CACHE_NAMESPACE, runnerId + ":" + ActivityType.RUN.name());
        cacheStore.put("route-source-revision", runnerId.toString(), java.util.UUID.randomUUID().toString(), Duration.ofDays(7));
    }

    public RouteHeatmapAnchorService(ActivityPointRepository activityPointRepository, TtlCacheStore cacheStore) {
        this.activityPointRepository = activityPointRepository;
        this.cacheStore = cacheStore;
    }

    public RouteAnchor findAnchor(Runner runner) {
        if (runner == null || runner.getId() == null) {
            return null;
        }
        // SQL counts the entire GPS history, but only one observed point enters
        // the application heap. Cache it per runner and activity type.
        String cacheKey = runner.getId() + ":" + ActivityType.RUN.name();
        RouteAnchor cached = cacheStore.get(ANCHOR_CACHE_NAMESPACE, cacheKey, RouteAnchor.class).orElse(null);
        if (cached != null) {
            return cached;
        }
        RouteAnchor anchor = findDatabaseAnchor(activityPointRepository, runner.getId());
        if (anchor != null) {
            cacheStore.put(ANCHOR_CACHE_NAMESPACE, cacheKey, anchor, ANCHOR_CACHE_TTL);
        }
        return anchor;
    }

    public static RouteAnchor findDatabaseAnchor(ActivityPointRepository points, long runnerId) {
        List<Object[]> rows = points.findDensestHeatmapAnchor(runnerId, ActivityType.RUN.name());
        if (rows == null || rows.isEmpty() || rows.get(0).length < 4) return null;
        Object[] row = rows.get(0);
        Double latitude = toFiniteDouble(row[0]);
        Double longitude = toFiniteDouble(row[1]);
        if (!isValidCoordinate(latitude, longitude) || !(row[2] instanceof Number activities)
                || !(row[3] instanceof Number count)) return null;
        return new RouteAnchor(latitude, longitude, activities.intValue(), count.intValue());
    }

    public static RouteAnchor selectAnchor(List<Object[]> pointRows) {
        if (pointRows == null || pointRows.isEmpty()) {
            return null;
        }

        Map<CellKey, HeatmapCell> cells = new HashMap<>();
        for (Object[] row : pointRows) {
            if (row == null || row.length < 3) {
                continue;
            }

            Long activityId = toLong(row[0]);
            Double latitude = toFiniteDouble(row[1]);
            Double longitude = toFiniteDouble(row[2]);
            if (activityId == null || !isValidCoordinate(latitude, longitude)) {
                continue;
            }

            CellKey key = new CellKey(
                    (long) Math.floor(latitude / CELL_DEGREES),
                    (long) Math.floor(longitude / CELL_DEGREES)
            );
            cells.computeIfAbsent(key, HeatmapCell::new).add(activityId, latitude, longitude);
        }

        HeatmapCell best = null;
        for (HeatmapCell candidate : cells.values()) {
            if (best == null || candidate.isPreferredOver(best)) {
                best = candidate;
            }
        }
        return best == null ? null : best.toAnchor(pointRows);
    }

    private static boolean isValidCoordinate(Double latitude, Double longitude) {
        return latitude != null
                && longitude != null
                && latitude >= -90
                && latitude <= 90
                && longitude >= -180
                && longitude <= 180
                && !(latitude == 0.0 && longitude == 0.0);
    }

    private static Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Double toFiniteDouble(Object value) {
        if (!(value instanceof Number number)) {
            return null;
        }
        double numberValue = number.doubleValue();
        return Double.isFinite(numberValue) ? numberValue : null;
    }

    public record RouteAnchor(double startLat, double startLng, int activityCount, int pointCount) {
        public boolean containsPoint(double latitude, double longitude) {
            return isValidCoordinate(latitude, longitude)
                    && Math.floor(latitude / CELL_DEGREES) == Math.floor(startLat / CELL_DEGREES)
                    && Math.floor(longitude / CELL_DEGREES) == Math.floor(startLng / CELL_DEGREES);
        }
    }

    private record CellKey(long latitudeBucket, long longitudeBucket) implements Comparable<CellKey> {
        @Override
        public int compareTo(CellKey other) {
            int latitudeComparison = Long.compare(latitudeBucket, other.latitudeBucket);
            return latitudeComparison != 0
                    ? latitudeComparison
                    : Long.compare(longitudeBucket, other.longitudeBucket);
        }
    }

    private static final class HeatmapCell {
        private final CellKey key;
        private final Set<Long> activityIds = new HashSet<>();
        private int pointCount;
        private double latitudeSum;
        private double longitudeSum;

        private HeatmapCell(CellKey key) {
            this.key = key;
        }

        private void add(long activityId, double latitude, double longitude) {
            activityIds.add(activityId);
            pointCount += 1;
            latitudeSum += latitude;
            longitudeSum += longitude;
        }

        private boolean isPreferredOver(HeatmapCell other) {
            if (pointCount != other.pointCount) {
                return pointCount > other.pointCount;
            }
            if (activityIds.size() != other.activityIds.size()) {
                return activityIds.size() > other.activityIds.size();
            }
            return key.compareTo(other.key) < 0;
        }

        private RouteAnchor toAnchor(List<Object[]> pointRows) {
            double centerLatitude = latitudeSum / pointCount;
            double centerLongitude = longitudeSum / pointCount;
            double longitudeScale = Math.cos(Math.toRadians(centerLatitude));
            double closestDistance = Double.POSITIVE_INFINITY;
            RouteAnchor anchor = null;
            for (Object[] row : pointRows) {
                if (row == null || row.length < 3 || toLong(row[0]) == null) {
                    continue;
                }
                Double latitude = toFiniteDouble(row[1]);
                Double longitude = toFiniteDouble(row[2]);
                if (!isValidCoordinate(latitude, longitude)
                        || Math.floor(latitude / CELL_DEGREES) != key.latitudeBucket()
                        || Math.floor(longitude / CELL_DEGREES) != key.longitudeBucket()) {
                    continue;
                }
                double latitudeOffset = latitude - centerLatitude;
                double longitudeOffset = (longitude - centerLongitude) * longitudeScale;
                double distance = latitudeOffset * latitudeOffset + longitudeOffset * longitudeOffset;
                if (distance < closestDistance
                        || (Double.compare(distance, closestDistance) == 0 && anchor != null
                        && (latitude < anchor.startLat()
                        || (Double.compare(latitude, anchor.startLat()) == 0 && longitude < anchor.startLng())))) {
                    closestDistance = distance;
                    anchor = new RouteAnchor(latitude, longitude, activityIds.size(), pointCount);
                }
            }
            return anchor;
        }
    }
}
