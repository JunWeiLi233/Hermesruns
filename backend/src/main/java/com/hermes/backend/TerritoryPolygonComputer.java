package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Pure-logic component that detects closed-loop polygons from an ordered list of GPS points.
 *
 * <p>Algorithm:
 * <ol>
 *   <li>Walk the polyline forward. For each new point P[i], scan all prior points P[0..i-LOOKBACK_MIN]
 *       for a "closure" — a prior point within CLOSE_DISTANCE_METERS of P[i].</li>
 *   <li>When a closure is found, extract the subsequence P[j..i] as a candidate loop.</li>
 *   <li>Compute shoelace area (equirectangular). Reject loops with area &lt; MIN_AREA_SQ_METERS.</li>
 *   <li>On acceptance, advance the walk pointer past the loop end to avoid re-detecting the same loop.</li>
 * </ol>
 *
 * <p>All geometry is performed in an equirectangular local projection — sufficient for typical running
 * routes of a few kilometres.
 */
@Component
public class TerritoryPolygonComputer {

    /** Maximum distance in metres between start/end points to qualify as a closed loop. */
    static final double CLOSE_DISTANCE_METERS = 80.0;

    /** Minimum enclosed area in square metres to keep a loop polygon (filters jitter / turn-arounds). */
    static final double MIN_AREA_SQ_METERS = 5_000.0;

    /**
     * Minimum number of points a loop subsequence must span.
     * Prevents matching a point against its immediate neighbours (which are ~metres apart).
     */
    private static final int LOOKBACK_MIN = 20;

    /** Metres per degree of latitude (constant, good enough globally for this use-case). */
    static final double METERS_PER_DEG_LAT = 111_320.0;

    /**
     * Detects all closed-loop polygons from an ordered list of lat/lng GPS points.
     *
     * @param points ordered list of [latitude, longitude] pairs.  May be empty or null.
     * @return list of detected polygons; each polygon is a non-empty list of [lat, lng] pairs (closed).
     */
    public List<DetectedPolygon> detectLoops(List<double[]> points) {
        List<DetectedPolygon> result = new ArrayList<>();

        if (points == null || points.size() < LOOKBACK_MIN + 1) {
            return result;
        }

        int n = points.size();
        int walkStart = 0; // first index eligible to be the start of the next loop

        for (int i = LOOKBACK_MIN; i < n; i++) {
            double[] cur = points.get(i);

            // Scan backwards from i-LOOKBACK_MIN down to walkStart for a close anchor
            int anchorIdx = -1;
            for (int j = i - LOOKBACK_MIN; j >= walkStart; j--) {
                double[] candidate = points.get(j);
                if (distanceMeters(cur[0], cur[1], candidate[0], candidate[1]) <= CLOSE_DISTANCE_METERS) {
                    anchorIdx = j;
                    break; // take the closest (innermost) match — smallest loop
                }
            }

            if (anchorIdx < 0) {
                continue;
            }

            // Extract loop subsequence [anchorIdx .. i]
            List<double[]> loopPoints = points.subList(anchorIdx, i + 1);

            double area = shoelaceAreaSqMeters(loopPoints);

            if (area >= MIN_AREA_SQ_METERS) {
                result.add(new DetectedPolygon(new ArrayList<>(loopPoints), area));
                // Advance past the detected loop so we don't re-detect nested sub-loops
                walkStart = i + 1;
                i = walkStart + LOOKBACK_MIN - 1; // -1 because the for-loop will do i++
            }
            // If area too small: do NOT advance — could be a larger enclosing loop further on.
            // Just continue scanning.
        }

        return result;
    }

    /**
     * Haversine distance is overkill here; equirectangular is sufficient for &lt;100 m comparisons.
     */
    static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double cosLat = Math.cos(Math.toRadians((lat1 + lat2) * 0.5));
        double dx = (lng2 - lng1) * cosLat * METERS_PER_DEG_LAT;
        double dy = (lat2 - lat1) * METERS_PER_DEG_LAT;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Shoelace (Gauss) area over an equirectangular projection.
     * Returns the absolute area in square metres.
     *
     * @param pts ordered sequence of [lat, lng] pairs forming the polygon boundary.
     */
    static double shoelaceAreaSqMeters(List<double[]> pts) {
        int n = pts.size();
        if (n < 3) return 0.0;

        // Pick a reference point to keep coordinate values small (numerical stability)
        double refLat = pts.get(0)[0];
        double refLng = pts.get(0)[1];
        double cosLat = Math.cos(Math.toRadians(refLat));

        double sum = 0.0;
        for (int i = 0; i < n; i++) {
            double[] a = pts.get(i);
            double[] b = pts.get((i + 1) % n);
            double x1 = (a[1] - refLng) * cosLat * METERS_PER_DEG_LAT;
            double y1 = (a[0] - refLat) * METERS_PER_DEG_LAT;
            double x2 = (b[1] - refLng) * cosLat * METERS_PER_DEG_LAT;
            double y2 = (b[0] - refLat) * METERS_PER_DEG_LAT;
            sum += (x1 * y2) - (x2 * y1);
        }
        return Math.abs(sum) * 0.5;
    }

    /**
     * Encodes a polygon point list to the storage format: "lat1,lng1;lat2,lng2;..."
     */
    public static String encodeCoordinates(List<double[]> points) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < points.size(); i++) {
            if (i > 0) sb.append(';');
            double[] pt = points.get(i);
            sb.append(round6(pt[0])).append(',').append(round6(pt[1]));
        }
        return sb.toString();
    }

    /**
     * Decodes the storage format back to [[lat, lng], ...] as a List of double[2].
     * Returns an empty list if the string is null or blank.
     */
    public static List<double[]> decodeCoordinates(String encoded) {
        List<double[]> result = new ArrayList<>();
        if (encoded == null || encoded.isBlank()) {
            return result;
        }
        String[] pairs = encoded.split(";");
        for (String pair : pairs) {
            if (pair.isBlank()) continue;
            String[] parts = pair.split(",", 2);
            if (parts.length != 2) continue;
            try {
                double lat = Double.parseDouble(parts[0].trim());
                double lng = Double.parseDouble(parts[1].trim());
                result.add(new double[]{lat, lng});
            } catch (NumberFormatException ignored) {
                // Skip malformed pair
            }
        }
        return result;
    }

    private static double round6(double v) {
        return Math.round(v * 1_000_000.0) / 1_000_000.0;
    }

    /**
     * Value type returned by {@link #detectLoops}.
     */
    public record DetectedPolygon(List<double[]> points, double areaSquareMeters) {}
}
