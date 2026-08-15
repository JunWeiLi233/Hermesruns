package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class RouteHeatmapAnchorService {

    private static final double CELL_DEGREES = 0.001;

    private final ActivityPointRepository activityPointRepository;

    public RouteHeatmapAnchorService(ActivityPointRepository activityPointRepository) {
        this.activityPointRepository = activityPointRepository;
    }

    public RouteAnchor findAnchor(Runner runner) {
        if (runner == null || runner.getId() == null) {
            return null;
        }
        return selectAnchor(activityPointRepository.findAllHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        ));
    }

    static RouteAnchor selectAnchor(List<Object[]> pointRows) {
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
        return best == null ? null : best.toAnchor();
    }

    private static boolean isValidCoordinate(Double latitude, Double longitude) {
        return latitude != null
                && longitude != null
                && latitude >= -90
                && latitude <= 90
                && longitude >= -180
                && longitude <= 180;
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
            if (activityIds.size() != other.activityIds.size()) {
                return activityIds.size() > other.activityIds.size();
            }
            if (pointCount != other.pointCount) {
                return pointCount > other.pointCount;
            }
            return key.compareTo(other.key) < 0;
        }

        private RouteAnchor toAnchor() {
            return new RouteAnchor(
                    latitudeSum / pointCount,
                    longitudeSum / pointCount,
                    activityIds.size(),
                    pointCount
            );
        }
    }
}
