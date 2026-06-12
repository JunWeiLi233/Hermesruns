package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Queue;
import java.util.Set;

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

    @Test
    void routeTerritoryReturnsFootprintForOutAndBackRun() {
        List<double[]> outAndBack = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        for (int i = 0; i <= 100; i++) {
            outAndBack.add(new double[]{baseLat + i * 0.0001, baseLng});
        }
        for (int i = 99; i >= 0; i--) {
            outAndBack.add(new double[]{baseLat + i * 0.0001, baseLng});
        }

        List<TerritoryPolygonComputer.DetectedPolygon> result = computer.detectTerritories(outAndBack);

        assertThat(result).hasSize(1);
        TerritoryPolygonComputer.DetectedPolygon footprint = result.get(0);
        assertThat(footprint.points()).hasSizeGreaterThan(8);
        assertThat(footprint.points().get(0)).containsExactly(footprint.points().get(footprint.points().size() - 1));
        assertThat(footprint.areaSquareMeters()).isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
    }

    @Test
    void routeTerritoryKeepsTrueLoopShapeWhenClosedLoopExists() {
        List<double[]> route = circularRoute(37.822, -122.25, 200.0, 60);

        List<TerritoryPolygonComputer.DetectedPolygon> loops = computer.detectLoops(route);
        List<TerritoryPolygonComputer.DetectedPolygon> territories = computer.detectTerritories(route);

        assertThat(territories).hasSize(1);
        assertThat(territories.get(0).areaSquareMeters()).isEqualTo(loops.get(0).areaSquareMeters());
        assertThat(territories.get(0).points()).hasSameSizeAs(loops.get(0).points());
    }

    @Test
    void landMaskClosedRouteFloodFillsConcreteInteriorCells() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 240.0;
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 18);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 18);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 18);
        addSegment(route, baseLat + latStep, baseLng, baseLat, baseLng, 18);

        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = computer.detectTerritoryMasks(route);

        assertThat(masks).hasSize(1);
        TerritoryPolygonComputer.DetectedTerritoryMask mask = masks.get(0);
        assertThat(mask.cells()).hasSizeGreaterThan(80);
        assertThat(mask.areaSquareMeters()).isGreaterThan(40_000.0);
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 1.5, baseLng + lngStep * 1.5)).isFalse();
    }

    @Test
    void landMaskNearClosedRouteSealsEndpointGapBeforeFloodFill() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 260.0;
        double gapMeters = 79.0;
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double gapLat = gapMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 18);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 18);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 18);
        addSegment(route, baseLat + latStep, baseLng, baseLat + gapLat, baseLng, 14);

        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = computer.detectTerritoryMasks(route);

        assertThat(masks).hasSize(1);
        TerritoryPolygonComputer.DetectedTerritoryMask mask = masks.get(0);
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
    }

    @Test
    void landMaskOpenRouteDoesNotFloodFillOutsideTheRoute() {
        List<double[]> route = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        for (int i = 0; i <= 80; i++) {
            route.add(new double[]{baseLat + i * 0.00008, baseLng});
        }

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(mask.cells()).isNotEmpty();
        assertThat(maskContains(mask, baseLat + 0.0032, baseLng)).isTrue();
        assertThat(maskContains(mask, baseLat + 0.0032, baseLng + 0.0015)).isFalse();
    }

    @Test
    void landMaskOpenRouteClaimsNarrowCorridorInsteadOfWideTerritoryBlock() {
        List<double[]> route = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        for (int i = 0; i <= 80; i++) {
            route.add(new double[]{baseLat + i * 0.00008, baseLng});
        }

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);
        double eastTwentyMeters = 20.0 / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(Math.toRadians(baseLat)));
        double eastThirtyFiveMeters = 35.0 / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(Math.toRadians(baseLat)));

        assertThat(mask.cells()).isNotEmpty();
        assertThat(mask.cellMeters()).isLessThanOrEqualTo(10.0);
        assertThat(mask.areaSquareMeters()).isLessThan(14_000.0);
        assertThat(maskContains(mask, baseLat + 0.0032, baseLng)).isTrue();
        assertThat(maskContains(mask, baseLat + 0.0032, baseLng + eastTwentyMeters)).isFalse();
        assertThat(maskContains(mask, baseLat + 0.0032, baseLng + eastThirtyFiveMeters)).isFalse();
    }

    @Test
    void landMaskSparseStraightRouteStaysConnectedBetweenGpsSamples() {
        List<double[]> route = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        double meterLat = 1.0 / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double meterLng = 1.0 / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(Math.toRadians(baseLat)));
        for (int i = 0; i <= 8; i++) {
            route.add(new double[]{
                    baseLat + i * 95.0 * meterLat,
                    baseLng + i * 65.0 * meterLng
            });
        }

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(mask.cells()).isNotEmpty();
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
        assertThat(maskContains(mask, baseLat + 2.5 * 95.0 * meterLat, baseLng + 2.5 * 65.0 * meterLng)).isTrue();
    }

    @Test
    void landMaskExactlyClosedRectangleFillsEntireInterior() {
        // Runner traces a rectangle A->B->C->D->A where the last point is exactly A.
        // The whole enclosed area must be marked, not just the boundary corridor.
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 320.0;
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 24);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 24);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 24);
        addSegment(route, baseLat + latStep, baseLng, baseLat, baseLng, 24);
        // Force the last GPS point to coincide exactly with the first.
        route.add(new double[]{baseLat, baseLng});

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        double centerLat = baseLat + latStep / 2.0;
        double centerLng = baseLng + lngStep / 2.0;
        double nearCornerLat = baseLat + latStep * 0.15;
        double nearCornerLng = baseLng + lngStep * 0.85;
        assertThat(maskContains(mask, centerLat, centerLng)).isTrue();
        // Any interior probe must be marked, not only the centroid.
        assertThat(maskContains(mask, nearCornerLat, nearCornerLng)).isTrue();
        // Outside the rectangle the cell must NOT be occupied.
        assertThat(maskContains(mask, baseLat + latStep * 1.4, baseLng + lngStep * 1.4)).isFalse();
        // Single contiguous occupied region for the closed loop.
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
        // Area should approach the geometric rectangle area, not just a thin perimeter corridor.
        double rectangleArea = sideMeters * sideMeters;
        assertThat(mask.areaSquareMeters()).isGreaterThan(rectangleArea * 0.7);
    }

    @Test
    void landMaskLongStraightLineStaysOneContiguousCorridorWhenGridAdaptsUpward() {
        // Long straight runs exceed MAX_LAND_MASK_GRID_CELLS at 8m resolution, forcing the grid to
        // adapt cellMeters upward. With the previous fixed 6m brush this routinely left wall gaps
        // along the line, breaking the corridor "into pieces". The route must stay one component.
        List<double[]> route = new ArrayList<>();
        double baseLat = 37.822;
        double baseLng = -122.25;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        // ~25 km east-bound run sampled every ~25 m.
        for (int i = 0; i <= 1000; i += 1) {
            double lng = baseLng + (i * 25.0) / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
            route.add(new double[]{baseLat, lng});
        }

        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = computer.detectTerritoryMasks(route);

        assertThat(masks).hasSize(1);
        TerritoryPolygonComputer.DetectedTerritoryMask mask = masks.get(0);
        assertThat(mask.cells()).isNotEmpty();
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
    }

    @Test
    void landMaskLargeRectangleAtAdaptiveGridStillFillsInterior() {
        // Big rectangle (>1 km2) triggers the grid's cellMeters adaptation. Previously the wider
        // cells produced wall gaps, the flood-fill leaked in, and the interior stayed unmarked.
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 1_200.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = sideMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 80);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 80);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 80);
        addSegment(route, baseLat + latStep, baseLng, baseLat, baseLng, 80);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        // Centroid must be covered.
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        // Deep interior probes (away from any edge) must be covered too.
        assertThat(maskContains(mask, baseLat + latStep * 0.25, baseLng + lngStep * 0.75)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 0.8, baseLng + lngStep * 0.2)).isTrue();
        // Area should reflect the enclosed land, not just the boundary corridor.
        double rectangleArea = sideMeters * sideMeters;
        assertThat(mask.areaSquareMeters()).isGreaterThan(rectangleArea * 0.5);
    }

    @Test
    void landMaskTriangleLoopFillsEnclosedPolygonInterior() {
        // Polygon (not rectangle) closed loop: ensure scanline fill handles general convex polygons,
        // not just axis-aligned shapes.
        double baseLat = 37.822;
        double baseLng = -122.25;
        double scale = 300.0 / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngScale = scale / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat + scale, baseLng + 0.5 * lngScale, 30);
        addSegment(route, baseLat + scale, baseLng + 0.5 * lngScale, baseLat, baseLng + lngScale, 30);
        addSegment(route, baseLat, baseLng + lngScale, baseLat, baseLng, 30);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        // Centroid of the triangle.
        double centroidLat = baseLat + scale / 3.0;
        double centroidLng = baseLng + 0.5 * lngScale;
        assertThat(maskContains(mask, centroidLat, centroidLng)).isTrue();
        // A point outside the triangle (above the apex) must not be marked.
        assertThat(maskContains(mask, baseLat + scale * 1.4, baseLng + 0.5 * lngScale)).isFalse();
    }

    @Test
    void landMaskMidRouteLoopSealsReturnToEarlierRouteAndFillsInterior() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 260.0;
        double gapMeters = 54.0;
        double tailMeters = 140.0;
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double gapLat = gapMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double tailLng = tailMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(Math.toRadians(baseLat)));
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng - tailLng, baseLat, baseLng, 10);
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 18);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 18);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 18);
        addSegment(route, baseLat + latStep, baseLng, baseLat + gapLat, baseLng, 14);
        addSegment(route, baseLat + gapLat, baseLng, baseLat + gapLat, baseLng - tailLng, 10);

        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = computer.detectTerritoryMasks(route);

        assertThat(masks).hasSize(1);
        TerritoryPolygonComputer.DetectedTerritoryMask mask = masks.get(0);
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 1.5, baseLng + lngStep * 1.5)).isFalse();
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

    private static void addSegment(List<double[]> points,
                                   double startLat,
                                   double startLng,
                                   double endLat,
                                   double endLng,
                                   int steps) {
        for (int i = 0; i <= steps; i++) {
            if (!points.isEmpty() && i == 0) {
                continue;
            }
            double pct = i / (double) steps;
            points.add(new double[]{
                    startLat + (endLat - startLat) * pct,
                    startLng + (endLng - startLng) * pct
            });
        }
    }

    private static boolean maskContains(TerritoryPolygonComputer.DetectedTerritoryMask mask, double lat, double lng) {
        return mask.cells().stream().anyMatch(cell ->
                TerritoryPolygonComputer.distanceMeters(cell.latitude(), cell.longitude(), lat, lng) <= mask.cellMeters() * 0.8
        );
    }

    private static int maskConnectedComponents(TerritoryPolygonComputer.DetectedTerritoryMask mask) {
        double cellMeters = mask.cellMeters();
        double refLat = mask.cells().get(0).latitude();
        double cosRef = Math.cos(Math.toRadians(refLat));
        Set<String> remaining = new HashSet<>();
        for (TerritoryPolygonComputer.MaskCell cell : mask.cells()) {
            long y = Math.round(cell.latitude() * TerritoryPolygonComputer.METERS_PER_DEG_LAT / cellMeters);
            long x = Math.round(cell.longitude() * TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosRef / cellMeters);
            remaining.add(x + ":" + y);
        }

        int components = 0;
        long[] dx = {1, -1, 0, 0};
        long[] dy = {0, 0, 1, -1};
        while (!remaining.isEmpty()) {
            components += 1;
            String first = remaining.iterator().next();
            remaining.remove(first);
            Queue<String> queue = new ArrayDeque<>();
            queue.add(first);
            while (!queue.isEmpty()) {
                String key = queue.remove();
                String[] parts = key.split(":", 2);
                long x = Long.parseLong(parts[0]);
                long y = Long.parseLong(parts[1]);
                for (int i = 0; i < dx.length; i++) {
                    String next = (x + dx[i]) + ":" + (y + dy[i]);
                    if (remaining.remove(next)) {
                        queue.add(next);
                    }
                }
            }
        }
        return components;
    }

    @Test
    void staleMaskEncodingDoesNotDecodeAsLegacyPolygonCoordinates() {
        String staleMask = "mask:v1:16|37.822,-122.25;37.823,-122.25";
        String previousWideMask = "mask:v2:16|37.822,-122.25;37.823,-122.25";
        String previousNarrowPreviewMask = "mask:v3:8|37.822,-122.25;37.823,-122.25";
        String previousConcretePreviewMask = "mask:v4:8|37.822,-122.25;37.823,-122.25";
        // v5 rows came from the older brush that left wall gaps on the adaptive grid; they must
        // decode as empty so the backfill scheduler recomputes them with the current algorithm.
        String previousGappyBrushMask = "mask:v5:8|37.822,-122.25;37.823,-122.25";

        assertThat(TerritoryPolygonComputer.decodeMaskCells(staleMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousWideMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousNarrowPreviewMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousConcretePreviewMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousGappyBrushMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(staleMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousWideMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousNarrowPreviewMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousConcretePreviewMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousGappyBrushMask)).isEmpty();
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
