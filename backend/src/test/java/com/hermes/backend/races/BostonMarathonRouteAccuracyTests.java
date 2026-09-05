package com.hermes.backend.races;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the persisted Boston Marathon course-map waypoints to real geography
 * so a future bulk regenerate / AI re-extract round can't silently put
 * "Newton" at 42.40° (6 km north of Newton) like the original cached route
 * did. If you redraw this route, update the corridor below with values
 * cross-referenced against the BAA official course map + OpenStreetMap.
 *
 * The expected corridor is generous on purpose — it catches gross errors
 * (e.g. waypoints landing in Vermont or in the Atlantic) without forcing a
 * micro-precise polyline that legitimate small adjustments would break.
 */
class BostonMarathonRouteAccuracyTests {

    // The marathon runs Hopkinton (west) → Boston (east) inside a narrow
    // east-west corridor. Any waypoint outside this rectangle is wrong by
    // kilometers, not meters. Numbers are slightly looser than the actual
    // course so hand-tuning city centers stays viable.
    private static final double CORRIDOR_SOUTH_LAT = 42.21;
    private static final double CORRIDOR_NORTH_LAT = 42.37;
    private static final double CORRIDOR_WEST_LNG = -71.53;
    private static final double CORRIDOR_EAST_LNG = -71.05;

    // The course is point-to-point west→east, so waypoints' longitudes must
    // increase (become less negative) monotonically from start to finish.
    // Allow one minor regression (the Hereford St / Boylston St block-level
    // turns near the finish can briefly nudge west by ~0.002°).
    private static final int MAX_LNG_REGRESSIONS_ALLOWED = 2;

    @Test
    void bostonMarathonRouteFollowsTheRealGeographicCorridor() throws Exception {
        JsonNode root = readRouteFixture();
        JsonNode points = root.get("routePoints");

        assertThat(points).isNotNull();
        assertThat(points.isArray()).isTrue();
        assertThat(points.size())
                .as("Boston course should have at least 10 waypoints so the polyline reads as a real route, not a sparse zig-zag")
                .isGreaterThanOrEqualTo(10);

        // Start in Hopkinton, finish on Boylston Street. ±5 km tolerance.
        double startLat = points.get(0).get("lat").asDouble();
        double startLng = points.get(0).get("lng").asDouble();
        assertThat(distanceKm(startLat, startLng, 42.2294, -71.5176))
                .as("First waypoint should be at the Hopkinton Town Common start")
                .isLessThan(5.0);

        JsonNode finish = points.get(points.size() - 1);
        double finishLat = finish.get("lat").asDouble();
        double finishLng = finish.get("lng").asDouble();
        assertThat(distanceKm(finishLat, finishLng, 42.3496, -71.0786))
                .as("Last waypoint should be the Boylston Street / Trinity Church finish")
                .isLessThan(5.0);

        // Every waypoint stays inside the east-west marathon corridor.
        List<String> outOfCorridor = new ArrayList<>();
        for (int i = 0; i < points.size(); i++) {
            JsonNode p = points.get(i);
            double lat = p.get("lat").asDouble();
            double lng = p.get("lng").asDouble();
            if (lat < CORRIDOR_SOUTH_LAT || lat > CORRIDOR_NORTH_LAT
                    || lng < CORRIDOR_WEST_LNG || lng > CORRIDOR_EAST_LNG) {
                outOfCorridor.add(String.format(
                        "#%d %s (%.4f, %.4f)",
                        i,
                        p.has("label") && !p.get("label").isNull() ? p.get("label").asText() : "unlabeled",
                        lat, lng
                ));
            }
        }
        assertThat(outOfCorridor)
                .as("Boston Marathon waypoints must stay inside the Hopkinton→Boston corridor [%s,%s] × [%s,%s]",
                        CORRIDOR_SOUTH_LAT, CORRIDOR_NORTH_LAT, CORRIDOR_WEST_LNG, CORRIDOR_EAST_LNG)
                .isEmpty();

        // Longitude trends west→east. A handful of regressions are allowed
        // (Boylston / Hereford turns near the finish), but not a wholesale
        // back-tracking.
        int regressions = 0;
        double prevLng = Double.NEGATIVE_INFINITY;
        for (int i = 0; i < points.size(); i++) {
            double lng = points.get(i).get("lng").asDouble();
            if (i > 0 && lng < prevLng - 0.0005) {
                regressions++;
            }
            prevLng = lng;
        }
        assertThat(regressions)
                .as("Boston Marathon runs west-to-east — waypoint longitudes should mostly increase")
                .isLessThanOrEqualTo(MAX_LNG_REGRESSIONS_ALLOWED);
    }

    @Test
    void overlayBoundsContainEveryWaypoint() throws Exception {
        JsonNode root = readRouteFixture();
        JsonNode bounds = root.get("overlayBounds");
        JsonNode points = root.get("routePoints");
        assertThat(bounds).isNotNull();
        assertThat(points).isNotNull();

        double north = bounds.get("north").asDouble();
        double south = bounds.get("south").asDouble();
        double east = bounds.get("east").asDouble();
        double west = bounds.get("west").asDouble();

        for (int i = 0; i < points.size(); i++) {
            JsonNode p = points.get(i);
            double lat = p.get("lat").asDouble();
            double lng = p.get("lng").asDouble();
            assertThat(lat).as("waypoint #%d lat must be inside [south, north]", i).isBetween(south, north);
            assertThat(lng).as("waypoint #%d lng must be inside [west, east]", i).isBetween(west, east);
        }
    }

    private static JsonNode readRouteFixture() throws IOException {
        try (InputStream input = BostonMarathonRouteAccuracyTests.class.getResourceAsStream(
                "/course-maps/boston-marathon-successful-route.json")) {
            assertThat(input).as("The tracked Boston course fixture must be on the test classpath").isNotNull();
            return new ObjectMapper().readTree(input);
        }
    }

    /** Haversine distance in km between two lat/lng points. */
    private static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
