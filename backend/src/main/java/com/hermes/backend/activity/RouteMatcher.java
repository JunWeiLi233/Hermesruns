package com.hermes.backend.activity;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Tells whether two runs took the same route, from where they started, where they finished, how far they went and which
 * way they went round. Pure: no database, no clock.
 *
 * <p>Two runs are the same route when both of these hold:</p>
 * <ul>
 *   <li>they start within 150 m of each other and finish within 150 m of each other, and the distances are within 5%;</li>
 *   <li>they go the same way: both are loops (they finish within 150 m of where they started) and go round the same way,
 *       or both are out-and-backs, or both are open routes. For an open route the two ends already fix the direction: a
 *       route run the other way round starts where the first one finished, so it is not within 150 m of its start.</li>
 * </ul>
 * <p>Strava names these criteria (start, end, direction, distance) and does not publish its thresholds, so the numbers
 * are Hermes' own and are settings. The comparison is made with the run that founded a group, so two runs that are each
 * within the thresholds of it are in one group even if they are not within them of each other.</p>
 *
 * <p>Known limits: the shape between the start and the finish is not compared, so two different loops of the same length
 * from the same door are one route; and a loop run from another point of the same circuit is another route.</p>
 */
final class RouteMatcher {

    static final double ENDPOINT_TOLERANCE_METERS = 150.0;
    static final double DISTANCE_TOLERANCE = 0.05;
    /** A run shorter than this is not matched: a few hundred metres is not a route. */
    static final double MIN_ROUTE_METERS = 1000.0;
    /** A loop that encloses less than this share of the area a circle of the same length would is an out-and-back. */
    static final double OUT_AND_BACK_AREA_RATIO = 0.05;
    private static final int MAX_AREA_POINTS = 400;
    private static final double EARTH_RADIUS_METERS = 6_371_000d;

    /** @param endpointMeters how far apart two starts, or two finishes, may be; @param distanceFraction how far apart the distances may be, as a share of the group's */
    record Tolerances(double endpointMeters, double distanceFraction) {
        static Tolerances defaults() {
            return new Tolerances(ENDPOINT_TOLERANCE_METERS, DISTANCE_TOLERANCE);
        }
    }

    /**
     * The route of one run.
     *
     * @param bearingDegrees from the start to the finish, 0 to 360 clockwise from north; null for a loop. It says which
     *                       way an open route goes; the match itself does not need it (see the class comment)
     * @param winding        +1 for a loop run counter-clockwise, -1 clockwise, 0 for an out-and-back and for open routes
     * @param loop           the run finished within the endpoint tolerance of where it started
     */
    record Route(double startLatitude, double startLongitude, double endLatitude, double endLongitude,
                 double distanceMeters, Double bearingDegrees, int winding, boolean loop) {
    }

    private RouteMatcher() {
    }

    /**
     * The route of a run, or null when it has no usable positions or is too short to be a route.
     *
     * @param latLngs        the run's positions in order, each {@code [latitude, longitude]}; unusable ones are skipped
     * @param distanceMeters the run's distance as the device recorded it; the length of the track when not positive
     */
    static Route of(List<double[]> latLngs, double distanceMeters, Tolerances tolerances) {
        List<double[]> points = new ArrayList<>();
        if (latLngs != null) {
            for (double[] point : latLngs) {
                if (usable(point)) {
                    points.add(point);
                }
            }
        }
        if (points.size() < 2) {
            return null;
        }
        double trackLength = 0.0;
        for (int i = 1; i < points.size(); i++) {
            trackLength += distance(points.get(i - 1), points.get(i));
        }
        double length = distanceMeters > 0 && Double.isFinite(distanceMeters) ? distanceMeters : trackLength;
        if (length < MIN_ROUTE_METERS) {
            return null;
        }
        double[] start = points.get(0);
        double[] end = points.get(points.size() - 1);
        boolean loop = distance(start, end) <= tolerances.endpointMeters();
        Double bearing = loop ? null : bearing(start, end);
        int winding = loop ? windingOf(points, trackLength) : 0;
        return new Route(start[0], start[1], end[0], end[1], length, bearing, winding, loop);
    }

    /**
     * How well {@code run} fits the group {@code route}, smaller being nearer; empty when it is not the same route.
     */
    static OptionalDouble fit(Route group, Route run, Tolerances tolerances) {
        if (group.loop() != run.loop()) {
            return OptionalDouble.empty();
        }
        if (group.loop() && group.winding() != run.winding()) {
            return OptionalDouble.empty();
        }
        double startGap = distance(group.startLatitude(), group.startLongitude(), run.startLatitude(), run.startLongitude());
        double endGap = distance(group.endLatitude(), group.endLongitude(), run.endLatitude(), run.endLongitude());
        if (startGap > tolerances.endpointMeters() || endGap > tolerances.endpointMeters()) {
            return OptionalDouble.empty();
        }
        double distanceGap = Math.abs(run.distanceMeters() - group.distanceMeters());
        if (distanceGap > tolerances.distanceFraction() * group.distanceMeters()) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(startGap + endGap + distanceGap * 0.01);
    }

    // ----- geometry -----

    private static boolean usable(double[] point) {
        return point != null && point.length >= 2
                && Double.isFinite(point[0]) && Double.isFinite(point[1])
                && Math.abs(point[0]) <= 90.0 && Math.abs(point[1]) <= 180.0
                && !(point[0] == 0.0 && point[1] == 0.0);
    }

    private static double distance(double[] a, double[] b) {
        return distance(a[0], a[1], b[0], b[1]);
    }

    private static double distance(double lat1, double lon1, double lat2, double lon2) {
        return ActivityAnalyticsHelper.haversineMeters(lat1, lon1, lat2, lon2);
    }

    /** The initial bearing from {@code from} to {@code to}, degrees clockwise from north. */
    static double bearing(double[] from, double[] to) {
        double lat1 = Math.toRadians(from[0]);
        double lat2 = Math.toRadians(to[0]);
        double dLon = Math.toRadians(to[1] - from[1]);
        double y = Math.sin(dLon) * Math.cos(lat2);
        double x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return (Math.toDegrees(Math.atan2(y, x)) + 360.0) % 360.0;
    }

    /**
     * Which way a loop goes round: +1 counter-clockwise, -1 clockwise, 0 when it encloses almost nothing (an
     * out-and-back). The area is the shoelace area of the track projected to a flat plane around its start.
     */
    private static int windingOf(List<double[]> points, double trackLength) {
        int stride = Math.max(1, points.size() / MAX_AREA_POINTS);
        double[] origin = points.get(0);
        double cosLat = Math.cos(Math.toRadians(origin[0]));
        List<double[]> flat = new ArrayList<>();
        for (int i = 0; i < points.size(); i += stride) {
            double[] point = points.get(i);
            flat.add(new double[] {
                    Math.toRadians(point[1] - origin[1]) * cosLat * EARTH_RADIUS_METERS,
                    Math.toRadians(point[0] - origin[0]) * EARTH_RADIUS_METERS
            });
        }
        double twiceArea = 0.0;
        for (int i = 0; i < flat.size(); i++) {
            double[] current = flat.get(i);
            double[] next = flat.get((i + 1) % flat.size());
            twiceArea += current[0] * next[1] - next[0] * current[1];
        }
        double area = twiceArea / 2.0;
        double circleArea = trackLength * trackLength / (4.0 * Math.PI);
        if (circleArea <= 0 || Math.abs(area) < OUT_AND_BACK_AREA_RATIO * circleArea) {
            return 0;
        }
        return area > 0 ? 1 : -1;
    }
}
