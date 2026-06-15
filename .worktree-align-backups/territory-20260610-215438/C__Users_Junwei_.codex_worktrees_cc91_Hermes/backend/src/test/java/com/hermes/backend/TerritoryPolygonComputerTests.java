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
    void landMaskClosedRouteFillsLoopInterior() {
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
        assertThat(mask.areaSquareMeters()).isGreaterThan(45_000.0);
        assertThat(mask.areaSquareMeters()).isLessThan(90_000.0);
        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 1.5, baseLng + lngStep * 1.5)).isFalse();
    }

    @Test
    void landMaskEndpointClosedRouteFillsInteriorWhenGapIsWithinClosureDistance() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 260.0;
        double gapMeters = 20.0;
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
        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
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
    void landMaskExactlyClosedRectangleFillsInterior() {
        // Runner traces a rectangle A->B->C->D->A where the last point is exactly A.
        // Territory land should claim the enclosed concrete area, not only the perimeter route.
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
        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, centerLat, centerLng)).isTrue();
        assertThat(maskContains(mask, nearCornerLat, nearCornerLng)).isTrue();
        // Outside the rectangle the cell must NOT be occupied.
        assertThat(maskContains(mask, baseLat + latStep * 1.4, baseLng + lngStep * 1.4)).isFalse();
        // Single contiguous occupied region for the closed loop.
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
        // Area should approach the full rectangle without leaking outside it.
        double rectangleArea = sideMeters * sideMeters;
        assertThat(mask.areaSquareMeters()).isGreaterThan(rectangleArea * 0.65);
        assertThat(mask.areaSquareMeters()).isLessThan(rectangleArea * 1.35);
    }

    @Test
    void landMaskLongStraightLineUsesSparseFixedResolutionCorridor() {
        // Long open runs exceed the old bounded-grid cap at 8m resolution. They should not inflate
        // to coarse 20m+ cells, because that turns a single-line run into a wide land roller.
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
        assertThat(mask.cellMeters()).isEqualTo(8.0);
        assertThat(mask.areaSquareMeters()).isLessThan(700_000.0);
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
    }

    @Test
    void landMaskLargeRectangleAtAdaptiveGridFillsLoopInterior() {
        // Big rectangle (>1 km2) triggers the grid's cellMeters adaptation. The filled loop should
        // remain connected and claim its enclosed interior without leaking outside.
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

        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 0.25, baseLng + lngStep * 0.75)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 0.8, baseLng + lngStep * 0.2)).isTrue();
        double rectangleArea = sideMeters * sideMeters;
        assertThat(mask.areaSquareMeters()).isGreaterThan(rectangleArea * 0.65);
        assertThat(mask.areaSquareMeters()).isLessThan(rectangleArea * 1.35);
    }

    @Test
    void landMaskLargeNearClosedLoopWithParkScaleEndpointGapStaysCorridor() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double widthMeters = 1_300.0;
        double heightMeters = 900.0;
        double gapMeters = 360.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double gapLat = gapMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 120);
        addSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 80);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 120);
        addSegment(route, baseLat + heightLat, baseLng, baseLat + gapLat, baseLng, 50);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng / 2.0)).isFalse();
        assertThat(maskContains(mask, baseLat + heightLat * 0.25, baseLng + widthLng * 0.75)).isFalse();
        assertThat(maskContains(mask, baseLat + heightLat * 1.35, baseLng + widthLng * 1.2)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(widthMeters * heightMeters * 0.22);
    }

    @Test
    void landMaskOpenCentralParkLengthRouteWithParkScaleEndpointGapStaysCorridor() {
        double baseLat = 40.7645;
        double baseLng = -73.9816;
        double widthMeters = 620.0;
        double heightMeters = 3_300.0;
        double endpointGapMeters = 340.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double endpointGapLng = endpointGapMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);

        List<double[]> route = new ArrayList<>();
        // Three sides of a long park route, then stop before returning to the start. The missing
        // south-side segment is real unrun land, not a GPS-gap closure.
        addSegment(route, baseLat, baseLng + endpointGapLng, baseLat, baseLng + widthLng, 24);
        addSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 180);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 60);
        addSegment(route, baseLat + heightLat, baseLng, baseLat, baseLng, 180);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(widthMeters * heightMeters * 0.18);
    }

    @Test
    void landMaskOpenLargeURouteDoesNotFillAcrossWideEndpointGap() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double widthMeters = 1_300.0;
        double heightMeters = 900.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 120);
        addSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 80);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 120);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(widthMeters * heightMeters * 0.22);
    }

    @Test
    void landMaskOpenCShapeKeepsRouteCoverageWithoutFillingUnrunInterior() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double widthMeters = 640.0;
        double heightMeters = 360.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 72);
        addSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 42);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 72);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat, baseLng + widthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat, baseLng + widthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(widthMeters * heightMeters * 0.25);
    }

    @Test
    void landMaskOpenReturnPathKeepsOnlyCorridorsBetweenParallelTracks() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double lengthMeters = 820.0;
        double separationMeters = 120.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double lengthLng = lengthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double separationLat = separationMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lengthLng, 92);
        addSegment(route, baseLat, baseLng + lengthLng, baseLat + separationLat, baseLng + lengthLng, 18);
        addSegment(route, baseLat + separationLat, baseLng + lengthLng, baseLat + separationLat, baseLng, 92);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat, baseLng + lengthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + separationLat, baseLng + lengthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + separationLat / 2.0, baseLng + lengthLng / 2.0)).isFalse();
        assertThat(maskContains(mask, baseLat + separationLat * 1.8, baseLng + lengthLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(lengthMeters * separationMeters * 0.35);
    }

    @Test
    void landMaskNarrowOpenReturnPathDoesNotFloodFillBetweenBrushedWalls() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double lengthMeters = 620.0;
        double separationMeters = 24.0;
        double lowerGapMeters = 96.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double separationLng = separationMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double lengthLat = lengthMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lowerGapLat = lowerGapMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat + lengthLat, baseLng, 90);
        addSegment(route, baseLat + lengthLat, baseLng, baseLat + lengthLat, baseLng + separationLng, 8);
        addSegment(route, baseLat + lengthLat, baseLng + separationLng, baseLat + lowerGapLat, baseLng + separationLng, 78);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + lengthLat / 2.0, baseLng)).isTrue();
        assertThat(maskContains(mask, baseLat + lengthLat / 2.0, baseLng + separationLng)).isTrue();
        assertThat(maskContains(mask, baseLat + lengthLat / 2.0, baseLng + separationLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(lengthMeters * separationMeters * 1.4);
    }

    @Test
    void landMaskTriangleLoopFillsInterior() {
        // Polygon (not rectangle) closed loop: ensure the interior is claimed.
        double baseLat = 37.822;
        double baseLng = -122.25;
        double scale = 300.0 / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngScale = scale / Math.cos(Math.toRadians(baseLat));
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng, baseLat + scale, baseLng + 0.5 * lngScale, 30);
        addSegment(route, baseLat + scale, baseLng + 0.5 * lngScale, baseLat, baseLng + lngScale, 30);
        addSegment(route, baseLat, baseLng + lngScale, baseLat, baseLng, 30);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        double centroidLat = baseLat + scale / 3.0;
        double centroidLng = baseLng + 0.5 * lngScale;
        assertThat(maskContains(mask, baseLat + scale / 2.0, baseLng + 0.25 * lngScale)).isTrue();
        assertThat(maskContains(mask, centroidLat, centroidLng)).isTrue();
        // A point outside the triangle (above the apex) must not be marked.
        assertThat(maskContains(mask, baseLat + scale * 1.4, baseLng + 0.5 * lngScale)).isFalse();
    }

    @Test
    void landMaskMidRouteGapWithTailsDoesNotFillUnrunInterior() {
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
        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isFalse();
        assertThat(maskContains(mask, baseLat + latStep * 1.5, baseLng + lngStep * 1.5)).isFalse();
    }

    @Test
    void landMaskMidRouteNearMissDoesNotBecomeFalseSelfLoopInterior() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 260.0;
        double gapMeters = 10.0;
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
        addSegment(route, baseLat + latStep, baseLng, baseLat + gapLat, baseLng, 18);
        addSegment(route, baseLat + gapLat, baseLng, baseLat + gapLat, baseLng - tailLng * 2.0, 10);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(sideMeters * sideMeters * 0.35);
    }

    @Test
    void landMaskLongLeadInEndpointClosureStaysCorridor() {
        double baseLat = 40.742;
        double baseLng = -73.823;
        double widthMeters = 1_200.0;
        double heightMeters = 780.0;
        double leadInMeters = 320.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double leadInLng = leadInMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        List<double[]> route = new ArrayList<>();

        addSegment(route, baseLat, baseLng - leadInLng, baseLat, baseLng, 32);
        addSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 72);
        addSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 48);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 72);
        addSegment(route, baseLat + heightLat, baseLng, baseLat, baseLng, 48);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat, baseLng + widthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat, baseLng + widthLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat / 2.0, baseLng + widthLng / 2.0)).isFalse();
        assertThat(mask.areaSquareMeters()).isLessThan(widthMeters * heightMeters * 0.24);
    }

    @Test
    void landMaskLeadInTailStillFillsLoopBody() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double sideMeters = 260.0;
        double tailMeters = 150.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double latStep = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = sideMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double tailLng = tailMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        List<double[]> route = new ArrayList<>();
        addSegment(route, baseLat, baseLng - tailLng, baseLat, baseLng, 14);
        addSegment(route, baseLat, baseLng, baseLat, baseLng + lngStep, 24);
        addSegment(route, baseLat, baseLng + lngStep, baseLat + latStep, baseLng + lngStep, 24);
        addSegment(route, baseLat + latStep, baseLng + lngStep, baseLat + latStep, baseLng, 24);
        addSegment(route, baseLat + latStep, baseLng, baseLat, baseLng, 24);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat, baseLng - tailLng / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep / 2.0, baseLng + lngStep / 2.0)).isTrue();
        assertThat(maskContains(mask, baseLat + latStep * 1.4, baseLng + lngStep * 1.4)).isFalse();
    }

    @Test
    void landMaskOverlappingSelfLoopsUsesLargestConcreteClosure() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double outerMeters = 430.0;
        double innerMeters = 130.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double outerLat = outerMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double outerLng = outerMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double innerLat = innerMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double innerLng = innerMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        List<double[]> route = new ArrayList<>();

        // Begin the larger loop, draw a smaller loop first, then complete the larger loop.
        // The first/inner greedy closure is not the user's actual enclosed territory.
        addSegment(route, baseLat, baseLng, baseLat, baseLng + outerLng, 60);
        addSegment(route, baseLat, baseLng + outerLng, baseLat + innerLat, baseLng + outerLng, 24);
        addSegment(route, baseLat + innerLat, baseLng + outerLng, baseLat + innerLat, baseLng + outerLng - innerLng, 24);
        addSegment(route, baseLat + innerLat, baseLng + outerLng - innerLng, baseLat, baseLng + outerLng - innerLng, 24);
        addSegment(route, baseLat, baseLng + outerLng - innerLng, baseLat, baseLng + outerLng, 24);
        addSegment(route, baseLat, baseLng + outerLng, baseLat + outerLat, baseLng + outerLng, 60);
        addSegment(route, baseLat + outerLat, baseLng + outerLng, baseLat + outerLat, baseLng, 60);
        addSegment(route, baseLat + outerLat, baseLng, baseLat, baseLng, 60);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + outerLat / 2.0, baseLng + outerLng / 2.0)).isTrue();
        assertThat(mask.areaSquareMeters()).isGreaterThan(outerMeters * outerMeters * 0.72);
    }

    @Test
    void landMaskClosedLoopWithInteriorCrossingFillsBoundedCompartments() {
        double baseLat = 37.822;
        double baseLng = -122.25;
        double widthMeters = 920.0;
        double heightMeters = 680.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();

        // A park loop can contain a real interior crossing/tail before it returns close to the
        // origin. The wall-bounded land on both sides should remain claimed instead of being lost
        // by even-odd polygon parity.
        addSegment(route, baseLat, baseLng, baseLat + heightLat, baseLng, 68);
        addSegment(route, baseLat + heightLat, baseLng, baseLat + heightLat, baseLng + widthLng, 92);
        addSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat * 0.42, baseLng + widthLng * 0.48, 48);
        addSegment(route, baseLat + heightLat * 0.42, baseLng + widthLng * 0.48, baseLat, baseLng + widthLng, 54);
        addSegment(route, baseLat, baseLng + widthLng, baseLat, baseLng, 92);

        TerritoryPolygonComputer.DetectedTerritoryMask mask = computer.detectTerritoryMasks(route).get(0);

        assertThat(maskContains(mask, baseLat + heightLat * 0.28, baseLng + widthLng * 0.24)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat * 0.28, baseLng + widthLng * 0.58)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat * 0.70, baseLng + widthLng * 0.44)).isTrue();
        assertThat(maskContains(mask, baseLat + heightLat * 1.35, baseLng + widthLng * 1.1)).isFalse();
        assertThat(maskConnectedComponents(mask)).isEqualTo(1);
        assertThat(mask.areaSquareMeters()).isGreaterThan(widthMeters * heightMeters * 0.48);
    }

    @Test
    void detachedMidRouteLoopsDoNotBecomeTerritoryPolygons() {
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

        assertThat(result).isEmpty();
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
        // v5 rows came from the older brush that left wall gaps on the adaptive grid; v7 rows came
        // from the route-corridor-only regression; v8 rows did not fill large near-closed park loops;
        // v9 rows could over-fill open park routes with hundreds of unrun metres between endpoints;
        // v10 rows could still fill wide unclosed run-back ribbons; v11 rows used a 35m self-near
        // closure tolerance that was still too generous for park roads that pass near each other;
        // v12 rows still used route-wall flood-fill that could claim bands between narrow open
        // parallel tracks; v13 rows still allowed 12m self-near closures that could inflate open
        // park-road near misses into false interiors; v14 rows selected the first/inner overlapping
        // self-loop and could miss the larger actual route shape; v15 rows still used even-odd
        // scanline fills that could under-fill self-crossing concrete park loops; v16 rows still
        // allowed mid-route self-near pockets; v17 rows could persist coarse fallback wedge previews;
        // v20 rows could store long open-route corridors on coarse adaptive grids.
        // Old rows must decode as empty so the backfill scheduler recomputes them with the current
        // loop-interior algorithm.
        String previousGappyBrushMask = "mask:v5:8|37.822,-122.25;37.823,-122.25";
        String previousLoopFillMask = "mask:v6:8|37.822,-122.25;37.823,-122.25";
        String previousCorridorOnlyMask = "mask:v7:8|37.822,-122.25;37.823,-122.25";
        String previousNearClosedLoopMask = "mask:v8:8|37.822,-122.25;37.823,-122.25";
        String previousParkScaleEndpointMask = "mask:v9:8|37.822,-122.25;37.823,-122.25";
        String previousOpenReturnRibbonMask = "mask:v10:8|37.822,-122.25;37.823,-122.25";
        String previousLooseSelfNearMask = "mask:v11:8|37.822,-122.25;37.823,-122.25";
        String previousRouteWallFloodMask = "mask:v12:8|37.822,-122.25;37.823,-122.25";
        String previousLooseParkRoadSelfLoopMask = "mask:v13:8|37.822,-122.25;37.823,-122.25";
        String previousInnerLoopFirstMask = "mask:v14:8|37.822,-122.25;37.823,-122.25";
        String previousEvenOddLoopFillMask = "mask:v15:8|37.822,-122.25;37.823,-122.25";
        String previousMidRoutePocketMask = "mask:v16:8|37.822,-122.25;37.823,-122.25";
        String previousCoarseFallbackWedgeMask = "mask:v17:8|37.822,-122.25;37.823,-122.25";
        String previousUnbumpedMidRouteMask = "mask:v18:8|37.822,-122.25;37.823,-122.25";
        String previousLongLeadInEndpointMask = "mask:v19:8|37.822,-122.25;37.823,-122.25";
        String previousAdaptiveOpenRouteMask = "mask:v20:24|37.822,-122.25;37.823,-122.25";

        assertThat(TerritoryPolygonComputer.decodeMaskCells(staleMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousWideMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousNarrowPreviewMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousConcretePreviewMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousGappyBrushMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousLoopFillMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousCorridorOnlyMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousNearClosedLoopMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousParkScaleEndpointMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousOpenReturnRibbonMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousLooseSelfNearMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousRouteWallFloodMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousLooseParkRoadSelfLoopMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousInnerLoopFirstMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousEvenOddLoopFillMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousMidRoutePocketMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousCoarseFallbackWedgeMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousUnbumpedMidRouteMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousLongLeadInEndpointMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeMaskCells(previousAdaptiveOpenRouteMask).cells()).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(staleMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousWideMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousNarrowPreviewMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousConcretePreviewMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousGappyBrushMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousLoopFillMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousCorridorOnlyMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousNearClosedLoopMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousParkScaleEndpointMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousOpenReturnRibbonMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousLooseSelfNearMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousRouteWallFloodMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousLooseParkRoadSelfLoopMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousInnerLoopFirstMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousEvenOddLoopFillMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousMidRoutePocketMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousCoarseFallbackWedgeMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousUnbumpedMidRouteMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousLongLeadInEndpointMask)).isEmpty();
        assertThat(TerritoryPolygonComputer.decodeCoordinates(previousAdaptiveOpenRouteMask)).isEmpty();
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
