package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for TerritoryPolygonComputer — no Spring context needed.
 */
class TerritoryPolygonComputerTests {

    private final TerritoryPolygonComputer computer = new TerritoryPolygonComputer();

    // -----------------------------------------------------------------------
    // Helper: build a simple N-gon approximating a circle
    // -----------------------------------------------------------------------
    /**
     * Generates a roughly circular route centred at (lat, lng) with radius ~radiusMeters.
     * 'n' points around the circle, then one extra point back near the start to trigger closure.
     */
    private List<double[]> circularRoute(double centerLat, double centerLng,
                                          double radiusMeters, int n) {
        double degRadius = radiusMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> points = new ArrayList<>();
        for (int i = 0; i <= n; i++) {
            double angle = 2 * Math.PI * i / n;
            double lat = centerLat + degRadius * Math.cos(angle);
            double lng = centerLng + degRadius * Math.sin(angle)
                    / Math.cos(Math.toRadians(centerLat));
            points.add(new double[]{lat, lng});
        }
        // Add a return point very close to index 0 to trigger closure detection
        double[] first = points.get(0);
        points.add(new double[]{first[0] + 0.00001, first[1] + 0.00001});
        return points;
    }

    // -----------------------------------------------------------------------
    // Test: one closed loop returns area > 0
    // -----------------------------------------------------------------------
    @Test
    void closedLoopReturnsOnePolygonWithPositiveArea() {
        // ~200 m radius circle — area ~125 000 m², well above 5 000 m² threshold
        List<double[]> route = circularRoute(37.822, -122.25, 200.0, 60);

        List<TerritoryPolygonComputer.DetectedPolygon> result = computer.detectLoops(route);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).areaSquareMeters()).isGreaterThan(0.0);
        assertThat(result.get(0).areaSquareMeters()).isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
    }

    // -----------------------------------------------------------------------
    // Test: out-and-back returns no polygon
    // -----------------------------------------------------------------------
    @Test
    void outAndBackReturnsNoPolygon() {
        // Straight line north then straight line back south (no area enclosed)
        List<double[]> outAndBack = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        // Go north 100 points
        for (int i = 0; i <= 100; i++) {
            outAndBack.add(new double[]{baseLat + i * 0.0001, baseLng});
        }
        // Come back south — points overlap outgoing track (zero area)
        for (int i = 99; i >= 0; i--) {
            outAndBack.add(new double[]{baseLat + i * 0.0001, baseLng});
        }

        List<TerritoryPolygonComputer.DetectedPolygon> result = computer.detectLoops(outAndBack);

        // Shoelace area on a degenerate line is 0, so no polygon should be returned
        assertThat(result).isEmpty();
    }

    // -----------------------------------------------------------------------
    // Test: two distinct loops return two polygons
    // -----------------------------------------------------------------------
    @Test
    void twoDistinctLoopsReturnTwoPolygons() {
        // First loop: 200 m radius circle at point A
        List<double[]> loop1 = circularRoute(37.822, -122.25, 200.0, 60);
        // Travel to a distant point (> 80 m away) before second loop
        List<double[]> transit = new ArrayList<>();
        for (int i = 1; i <= 40; i++) {
            transit.add(new double[]{37.822 + i * 0.005, -122.25});
        }
        // Second loop: 200 m radius circle at point B
        double b2Lat = 37.822 + 41 * 0.005;
        List<double[]> loop2 = circularRoute(b2Lat, -122.25, 200.0, 60);

        List<double[]> combined = new ArrayList<>();
        combined.addAll(loop1);
        combined.addAll(transit);
        combined.addAll(loop2);

        List<TerritoryPolygonComputer.DetectedPolygon> result = computer.detectLoops(combined);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).areaSquareMeters()).isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
        assertThat(result.get(1).areaSquareMeters()).isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
    }

    // -----------------------------------------------------------------------
    // Test: malformed/empty samples return empty list
    // -----------------------------------------------------------------------
    @Test
    void emptyPointsListReturnsEmpty() {
        assertThat(computer.detectLoops(Collections.emptyList())).isEmpty();
    }

    @Test
    void nullPointsListReturnsEmpty() {
        assertThat(computer.detectLoops(null)).isEmpty();
    }

    @Test
    void tooFewPointsReturnsEmpty() {
        List<double[]> tiny = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tiny.add(new double[]{37.822 + i * 0.0001, -122.25});
        }
        assertThat(computer.detectLoops(tiny)).isEmpty();
    }

    // -----------------------------------------------------------------------
    // Test: tiny loop (area < 5000 m²) is rejected
    // -----------------------------------------------------------------------
    @Test
    void tinyLoopBelowAreaThresholdIsRejected() {
        // ~30 m radius circle — area ~2 800 m², below 5 000 threshold
        List<double[]> route = circularRoute(37.822, -122.25, 30.0, 60);

        List<TerritoryPolygonComputer.DetectedPolygon> result = computer.detectLoops(route);

        assertThat(result).isEmpty();
    }

    // -----------------------------------------------------------------------
    // Test: encode/decode round-trip
    // -----------------------------------------------------------------------
    @Test
    void encodeDecodeRoundTrip() {
        List<double[]> original = List.of(
                new double[]{37.822100, -122.250100},
                new double[]{37.823000, -122.250200},
                new double[]{37.822500, -122.249000},
                new double[]{37.822100, -122.250100}
        );

        String encoded = TerritoryPolygonComputer.encodeCoordinates(original);
        List<double[]> decoded = TerritoryPolygonComputer.decodeCoordinates(encoded);

        assertThat(decoded).hasSize(original.size());
        for (int i = 0; i < original.size(); i++) {
            assertThat(decoded.get(i)[0]).isCloseTo(original.get(i)[0], org.assertj.core.data.Offset.offset(0.000001));
            assertThat(decoded.get(i)[1]).isCloseTo(original.get(i)[1], org.assertj.core.data.Offset.offset(0.000001));
        }
    }

    @Test
    void decodeEmptyStringReturnsEmptyList() {
        assertThat(TerritoryPolygonComputer.decodeCoordinates("")).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(null)).isEmpty();
    }

    // -----------------------------------------------------------------------
    // Test: shoelace area of a known square
    // -----------------------------------------------------------------------
    @Test
    void shoelaceAreaForKnownSquareIsCorrect() {
        // 100 m × 100 m square in equirectangular space near equator
        // One degree lat ≈ 111 320 m. So 0.0009° ≈ 100 m
        double latDeg = 100.0 / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lat0 = 0.0;
        double lng0 = 0.0;
        List<double[]> square = List.of(
                new double[]{lat0,          lng0},
                new double[]{lat0 + latDeg, lng0},
                new double[]{lat0 + latDeg, lng0 + latDeg},
                new double[]{lat0,          lng0 + latDeg}
        );
        double area = TerritoryPolygonComputer.shoelaceAreaSqMeters(square);
        // Expected: ~10 000 m² (100 × 100)
        assertThat(area).isGreaterThan(9_000.0).isLessThan(11_000.0);
    }
}
