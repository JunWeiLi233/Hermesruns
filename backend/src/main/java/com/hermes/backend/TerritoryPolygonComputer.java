package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    /** Maximum GPS gap in metres between route endpoints to qualify as a real closed loop. */
    static final double CLOSE_DISTANCE_METERS = 6.0;

    /** Self-near loops must be almost exact; nearby parallel park roads are not territory closures. */
    static final double SELF_INTERSECTION_CLOSE_DISTANCE_METERS = 6.0;

    /** Minimum enclosed area in square metres to keep a loop polygon (filters jitter / turn-arounds). */
    static final double MIN_AREA_SQ_METERS = 5_000.0;

    /** Closed loops thinner than this are effectively out-and-back route corridors, not conquered land. */
    private static final double MIN_LOOP_INTERIOR_WIDTH_METERS = 32.0;

    /** Route-footprint buffer used when a run does not form a true closed loop. */
    static final double ROUTE_FOOTPRINT_BUFFER_METERS = 45.0;

    /** Concrete map-mask resolution. Smaller values keep single-line conquest close to the actual route. */
    static final double LAND_MASK_CELL_METERS = 8.0;

    /** Painted route thickness for stored land border cells. */
    static final double LAND_MASK_ROUTE_RADIUS_METERS = 6.0;

    /**
     * Route-wall thickness used only while detecting enclosed faces. Keep this tight so near-miss
     * paths do not accidentally seal into land.
     */
    private static final double LAND_MASK_BOUNDARY_RADIUS_METERS = 2.0;

    /** A territory boundary must be backed by concrete route samples, not a sparse generated outline. */
    private static final int MIN_LAND_MASK_ROUTE_POINTS = 48;

    /** GPS gaps larger than this are unrun boundary gaps, so the route cannot seal land across them. */
    private static final double MAX_LAND_MASK_ROUTE_SEGMENT_METERS = 70.0;

    /** Rasterized interior regions must still have a meaningful width, not just a skinny ribbon. */
    private static final double MIN_INTERIOR_REGION_WIDTH_METERS = 20.0;

    /**
     * A loop that closes at only one route endpoint may have only a GPS-noise-scale warmup/cooldown tail.
     * Longer tails mean the route did not concretely return to its original point and must stay a
     * route corridor rather than filling the inferred interior.
     */
    private static final double MAX_ONE_ENDED_LOOP_TAIL_METERS = 8.0;

    /** Hard cap so long rural runs do not create unbounded in-memory masks. */
    private static final int MAX_LAND_MASK_GRID_CELLS = 24_000;

    private static final int LAND_MASK_GRID_PADDING_CELLS = 4;

    private static final int MIN_LAND_MASK_CELLS = 4;

    private static final String LAND_MASK_ANY_PREFIX = "mask:";

    // Bumped from v13 -> v14 when self-near loop closure tightened to exact-return tolerance. v13
    // rows could still fill false Central-Park-like interiors where nearby roads passed within 12m.
    // Bumped from v12 -> v13 when route-wall flood-fill was removed. v12 rows could still fill the
    // unrun band between open parallel tracks when the brushed corridor accidentally enclosed space.
    // Bumped from v11 -> v12 when the false self-near closure tolerance tightened from 35m to 25m.
    // Bumped from v10 -> v11 when open return paths stopped filling wide run-back ribbons. v10 rows
    // could still claim the unrun space between parallel tracks as if the route were closed.
    // Bumped from v9 -> v10 when park-scale endpoint gaps stopped auto-filling open routes. v9 rows
    // could bridge hundreds of unrun metres and fill Central-Park-like open paths as whole territory.
    // Bumped from v8 -> v9 when large near-closed loop territory masks were restored. v8 rows stored
    // park-scale start/finish gap loops as route corridors, leaving hollow territories on /territory.
    // Bumped from v7 -> v8 when closed-loop territory masks were restored. v7 rows only stored
    // route corridors, which made legitimate loop-enclosed territory render with broken hollow
    // interiors on /territory.
    // Bumped from v14 -> v15 when overlapping self-near loop selection changed from first/inner
    // closure to largest non-overlapping closure. v14 rows could fill a smaller lake loop while
    // ignoring the larger concrete route shape that enclosed it.
    // Bumped from v15 -> v16 when closed-loop interiors switched from even-odd polygon scanlines to
    // route-wall flood fill. v15 rows could under-fill self-crossing park loops with real enclosures.
    // Bumped from v16 -> v17 when mid-route self-near pockets stopped being accepted as territory
    // loops. Those rows could fill Central-Park-like wedges in otherwise open routes.
    // Bumped from v17 -> v18 when the territory page stopped treating coarse /api/territory cell
    // fallbacks as concrete land. Recompute to drop any previously persisted wedge-like previews.
    // Bumped from v18 -> v19 after live data showed v18 rows persisted before mid-route
    // self-near pockets were fully endpoint-gated, leaving stale broad park/Flushing fills.
    // Bumped from v19 -> v20 when one-ended loops with park-scale lead-in/out tails stopped
    // filling huge open route slabs; only short warmup/cooldown tails may still fill.
    // Bumped from v20 -> v21 when open routes switched to sparse fixed-resolution corridors
    // instead of adaptive bbox grids that made long single-line runs render as wide land rollers.
    // Bumped from v21 -> v22 when one-ended loop tail tolerance tightened from 180m to 40m.
    // Bumped from v22 -> v23 when endpoint and one-ended closure tolerance tightened to 12m.
    // Older rows could still fill broad false interiors when a run passed near its start but finished
    // one or more city-block widths away from the concrete closure point.
    // Bumped from v23 -> v24 after live Kissena rows showed partial compartment fills persisted
    // under the current prefix; recompute so endpoint-closed park loops fill one solid interior.
    // Bumped from v24 -> v25 when open-route corridors stopped being encoded as land territory.
    // v24 rows made route-only Boston/shared-runner activity traces render as conquered land.
    // Bumped from v25 -> v26 when endpoint-closed loop tolerance tightened from 12m to 6m.
    // Bumped from v26 -> v27 when origin-anchored cooldown tails stopped filling loops unless
    // the actual route finish is also at the origin.
    // Bumped from v27 -> v28 when skinny endpoint-closed out-and-back loops stopped counting as land.
    // v25 rows could still fill Kissena-style routes that finished near the start without a
    // concrete GPS closure.
    // Bumped from v28 -> v29 when territory stopped persisting open-route corridors entirely and
    // land switched to single-run enclosed-region detection from the route wall itself. v28 rows
    // could still render corridor-only traces or preserve false park/Flushing pieces.
    // Bumped from v29 -> v30 when sparse generated closed outlines stopped qualifying as land.
    // A run must have concrete GPS sample coverage on the boundary before any interior can be owned.
    private static final String LAND_MASK_PREFIX = "mask:v30:";

    // v5 rows came from an older brush that left wall gaps on adaptive grids; v7 rows came from the
    // route-corridor-only regression. Decoding treats old rows as empty so backfill recomputes them.

    /** Minimum usable GPS samples before a route can claim fallback territory. */
    private static final int MIN_ROUTE_FOOTPRINT_POINTS = 8;

    /** Drop near-duplicate GPS points so stationary jitter does not distort the route footprint. */
    private static final double MIN_ROUTE_POINT_SPACING_METERS = 5.0;

    /** Keep persisted fallback polygons compact even for long runs. */
    private static final int MAX_ROUTE_FOOTPRINT_ANCHORS = 96;

    /**
     * Minimum number of points a loop subsequence must span.
     * Prevents matching a point against its immediate neighbours (which are ~metres apart).
     */
    private static final int LOOKBACK_MIN = 20;

    /** Metres per degree of latitude (constant, good enough globally for this use-case). */
    static final double METERS_PER_DEG_LAT = 111_320.0;

    /**
     * Detects route territory for a run.
     *
     * <p>True closed-loop routes keep their precise detected loop polygons. If the route does not close,
     * the fallback returns one buffered route footprint so every sufficiently sampled run can still
     * light up a territory on the map.</p>
     */
    public List<DetectedPolygon> detectTerritories(List<double[]> points) {
        List<DetectedPolygon> closedLoops = detectLoops(points);
        if (!closedLoops.isEmpty()) {
            return closedLoops;
        }

        DetectedPolygon routeFootprint = routeFootprintPolygon(points);
        return routeFootprint == null ? List.of() : List.of(routeFootprint);
    }

    /**
     * Detects the concrete conquered land mask for a run.
     *
     * <p>The route is painted onto a metre grid as concrete corridor cells. Explicitly closed loops
     * rasterize their interiors into that same claimed-cell grid. Open routes, including C shapes and
     * return paths on near-parallel roads, stay corridor-only and never infer ownership from a generic
     * flood-fill of the brushed route wall.</p>
     */
    public List<DetectedTerritoryMask> detectTerritoryMasks(List<double[]> rawPoints) {
        List<double[]> points = cleanRoutePoints(rawPoints);
        if (points.size() < MIN_ROUTE_FOOTPRINT_POINTS) {
            return List.of();
        }

        double refLat = points.get(0)[0];
        double refLng = points.get(0)[1];
        double cosLat = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosLat) < 1e-6) {
            return List.of();
        }

        List<ProjectedPoint> projected = new ArrayList<>(points.size());
        for (double[] point : points) {
            projected.add(project(point[0], point[1], refLat, refLng, cosLat));
        }
        if (!hasConcreteBoundarySampling(projected)) {
            return List.of();
        }

        LandMaskGrid grid = LandMaskGrid.forProjected(projected, LAND_MASK_CELL_METERS * 0.5);
        if (grid.totalCells() <= 0) {
            return List.of();
        }

        boolean[] routeWall = new boolean[grid.totalCells()];
        for (int i = 1; i < projected.size(); i += 1) {
            paintBoundaryRouteSegment(routeWall, grid, projected.get(i - 1), projected.get(i));
        }
        List<DetectedPolygon> detectedLoops = detectLoops(points);
        if (!shouldCloseEndpointLoop(projected) && detectedLoops.isEmpty()) {
            return List.of();
        }

        paintEndpointClosure(routeWall, grid, projected);
        paintDetectedLoopClosures(routeWall, grid, points, projected, detectedLoops);
        List<InteriorRegion> interiorRegions = enclosedInteriorRegions(routeWall, grid);
        if (interiorRegions.isEmpty()) {
            return List.of();
        }

        boolean[] acceptedInterior = new boolean[grid.totalCells()];
        for (InteriorRegion region : interiorRegions) {
            if (!isMeaningfulInteriorRegion(region, projectedPathDistanceMeters(projected), grid)) {
                continue;
            }
            for (int index : region.cellIndexes()) {
                acceptedInterior[index] = true;
            }
        }

        boolean[] claimedLand = territoryCellsFromAcceptedInterior(acceptedInterior, routeWall, grid);
        if (!hasClaimedCells(claimedLand)) {
            return List.of();
        }

        List<MaskCell> cells = new ArrayList<>();
        for (int y = 0; y < grid.height; y += 1) {
            for (int x = 0; x < grid.width; x += 1) {
                int index = grid.index(x, y);
                if (!claimedLand[index]) {
                    continue;
                }
                double[] center = unproject(grid.centerOf(x, y), refLat, refLng, cosLat);
                cells.add(new MaskCell(round6(center[0]), round6(center[1])));
            }
        }

        if (cells.size() < MIN_LAND_MASK_CELLS) {
            return List.of();
        }

        double area = cells.size() * grid.cellMeters * grid.cellMeters;
        return List.of(new DetectedTerritoryMask(cells, grid.cellMeters, area, TerritoryMaskKind.LAND));
    }

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

        List<DetectedPolygon> largestLoops = detectLargestNonOverlappingLoops(points);
        if (!largestLoops.isEmpty()) {
            return largestLoops;
        }

        int n = points.size();
        int walkStart = 0; // first index eligible to be the start of the next loop

        for (int i = LOOKBACK_MIN; i < n; i++) {
            double[] cur = points.get(i);

            // Scan backwards from i-LOOKBACK_MIN down to walkStart for a close anchor
            int anchorIdx = -1;
            for (int j = i - LOOKBACK_MIN; j >= walkStart; j--) {
                double[] candidate = points.get(j);
                if (distanceMeters(cur[0], cur[1], candidate[0], candidate[1]) <= SELF_INTERSECTION_CLOSE_DISTANCE_METERS) {
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

            if (area >= MIN_AREA_SQ_METERS
                    && isEndpointAnchoredLoop(points, anchorIdx, i)
                    && hasMeaningfulLoopInterior(points, anchorIdx, i, area)) {
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

    private List<DetectedPolygon> detectLargestNonOverlappingLoops(List<double[]> points) {
        List<LoopCandidate> candidates = new ArrayList<>();
        int n = points.size();
        for (int i = LOOKBACK_MIN; i < n; i++) {
            double[] cur = points.get(i);
            for (int j = i - LOOKBACK_MIN; j >= 0; j--) {
                double[] candidate = points.get(j);
                if (distanceMeters(cur[0], cur[1], candidate[0], candidate[1]) > SELF_INTERSECTION_CLOSE_DISTANCE_METERS) {
                    continue;
                }
                List<double[]> loopPoints = points.subList(j, i + 1);
                double area = shoelaceAreaSqMeters(loopPoints);
                if (area >= MIN_AREA_SQ_METERS
                        && isEndpointAnchoredLoop(points, j, i)
                        && hasMeaningfulLoopInterior(points, j, i, area)) {
                    candidates.add(new LoopCandidate(j, i, new ArrayList<>(loopPoints), area));
                }
            }
        }

        candidates.sort((left, right) -> {
            int areaCompare = Double.compare(right.areaSquareMeters(), left.areaSquareMeters());
            if (areaCompare != 0) {
                return areaCompare;
            }
            int startCompare = Integer.compare(left.startIndex(), right.startIndex());
            return startCompare != 0 ? startCompare : Integer.compare(left.endIndex(), right.endIndex());
        });

        List<LoopCandidate> selected = new ArrayList<>();
        for (LoopCandidate candidate : candidates) {
            boolean overlapsSelectedLoop = selected.stream()
                    .anyMatch(selectedLoop -> intervalsOverlap(candidate, selectedLoop));
            if (!overlapsSelectedLoop) {
                selected.add(candidate);
            }
        }

        selected.sort((left, right) -> Integer.compare(left.startIndex(), right.startIndex()));
        List<DetectedPolygon> loops = new ArrayList<>();
        for (LoopCandidate candidate : selected) {
            loops.add(new DetectedPolygon(candidate.points(), candidate.areaSquareMeters()));
        }
        return loops;
    }

    private static boolean intervalsOverlap(LoopCandidate left, LoopCandidate right) {
        return left.startIndex() < right.endIndex() && right.startIndex() < left.endIndex();
    }

    private static boolean isEndpointAnchoredLoop(List<double[]> points, int startIndex, int endIndex) {
        int pointCount = points == null ? 0 : points.size();
        if (pointCount <= 0) {
            return false;
        }
        boolean startsAtRouteOrigin = startIndex <= 0;
        boolean endsAtRouteFinish = endIndex >= pointCount - 1;
        if (startsAtRouteOrigin && endsAtRouteFinish) {
            return true;
        }
        if (startsAtRouteOrigin) {
            if (routeDistanceMeters(points, Math.max(0, endIndex), pointCount - 1) > MAX_ONE_ENDED_LOOP_TAIL_METERS) {
                return false;
            }
            double[] origin = points.get(0);
            double[] finish = points.get(pointCount - 1);
            return distanceMeters(origin[0], origin[1], finish[0], finish[1]) <= CLOSE_DISTANCE_METERS;
        }
        if (endsAtRouteFinish) {
            return routeDistanceMeters(points, 0, Math.max(0, startIndex)) <= MAX_ONE_ENDED_LOOP_TAIL_METERS;
        }
        return false;
    }

    private static double routeDistanceMeters(List<double[]> points, int startIndex, int endIndex) {
        if (points == null || points.size() < 2 || startIndex == endIndex) {
            return 0.0;
        }
        int from = Math.max(0, Math.min(startIndex, endIndex));
        int to = Math.min(points.size() - 1, Math.max(startIndex, endIndex));
        double total = 0.0;
        for (int i = from + 1; i <= to; i += 1) {
            double[] previous = points.get(i - 1);
            double[] current = points.get(i);
            if (previous == null || current == null || previous.length < 2 || current.length < 2) {
                continue;
            }
            total += distanceMeters(previous[0], previous[1], current[0], current[1]);
        }
        return total;
    }

    private static boolean hasMeaningfulLoopInterior(List<double[]> points,
                                                     int startIndex,
                                                     int endIndex,
                                                     double areaSquareMeters) {
        if (!Double.isFinite(areaSquareMeters) || areaSquareMeters < MIN_AREA_SQ_METERS) {
            return false;
        }
        double pathDistanceMeters = routeDistanceMeters(points, startIndex, endIndex);
        return pathDistanceMeters > 0.0
                && areaSquareMeters / pathDistanceMeters >= MIN_LOOP_INTERIOR_WIDTH_METERS;
    }

    private DetectedPolygon routeFootprintPolygon(List<double[]> rawPoints) {
        List<double[]> points = cleanRoutePoints(rawPoints);
        if (points.size() < MIN_ROUTE_FOOTPRINT_POINTS) {
            return null;
        }

        double refLat = points.get(0)[0];
        double refLng = points.get(0)[1];
        double cosLat = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosLat) < 1e-6) {
            return null;
        }

        List<ProjectedPoint> projected = new ArrayList<>(points.size());
        for (double[] point : points) {
            projected.add(project(point[0], point[1], refLat, refLng, cosLat));
        }

        List<ProjectedPoint> anchors = downsample(projected, MAX_ROUTE_FOOTPRINT_ANCHORS);
        List<ProjectedPoint> bufferedPoints = new ArrayList<>(anchors.size() * 8);
        for (ProjectedPoint anchor : anchors) {
            for (int i = 0; i < 8; i += 1) {
                double angle = 2.0 * Math.PI * i / 8.0;
                bufferedPoints.add(new ProjectedPoint(
                        anchor.x + Math.cos(angle) * ROUTE_FOOTPRINT_BUFFER_METERS,
                        anchor.y + Math.sin(angle) * ROUTE_FOOTPRINT_BUFFER_METERS
                ));
            }
        }

        List<ProjectedPoint> hull = convexHull(bufferedPoints);
        if (hull.size() < 3) {
            return null;
        }

        List<double[]> coordinates = new ArrayList<>(hull.size() + 1);
        for (ProjectedPoint point : hull) {
            coordinates.add(unproject(point, refLat, refLng, cosLat));
        }
        coordinates.add(new double[]{coordinates.get(0)[0], coordinates.get(0)[1]});

        double area = shoelaceAreaSqMeters(coordinates);
        if (area < MIN_AREA_SQ_METERS) {
            return null;
        }
        return new DetectedPolygon(coordinates, area);
    }

    private static List<double[]> cleanRoutePoints(List<double[]> rawPoints) {
        List<double[]> validPoints = new ArrayList<>();
        if (rawPoints == null) {
            return validPoints;
        }

        for (double[] point : rawPoints) {
            if (point == null || point.length < 2) {
                continue;
            }
            double lat = point[0];
            double lng = point[1];
            if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
                continue;
            }
            validPoints.add(new double[]{lat, lng});
        }
        if (validPoints.isEmpty()) {
            return validPoints;
        }

        List<double[]> result = new ArrayList<>();
        double[] previous = null;
        for (double[] point : validPoints) {
            double lat = point[0];
            double lng = point[1];
            if (previous == null || distanceMeters(previous[0], previous[1], lat, lng) >= MIN_ROUTE_POINT_SPACING_METERS) {
                double[] cleaned = new double[]{lat, lng};
                result.add(cleaned);
                previous = cleaned;
            }
        }
        double[] finalPoint = validPoints.get(validPoints.size() - 1);
        if (result.isEmpty()) {
            result.add(finalPoint);
        } else {
            double[] retainedFinalPoint = result.get(result.size() - 1);
            if (Double.compare(retainedFinalPoint[0], finalPoint[0]) != 0
                    || Double.compare(retainedFinalPoint[1], finalPoint[1]) != 0) {
                result.add(finalPoint);
            }
        }
        return result;
    }

    private static void paintBoundaryRouteSegment(boolean[] routeWall, LandMaskGrid grid, ProjectedPoint start, ProjectedPoint end) {
        double dx = end.x - start.x;
        double dy = end.y - start.y;
        double distance = Math.sqrt(dx * dx + dy * dy);
        int steps = Math.max(1, (int) Math.ceil(distance / Math.max(1.0, grid.cellMeters * 0.35)));
        for (int i = 0; i <= steps; i += 1) {
            double pct = i / (double) steps;
            paintBoundaryRoutePoint(routeWall, grid, new ProjectedPoint(start.x + dx * pct, start.y + dy * pct));
        }
    }

    private static void paintEndpointClosure(boolean[] routeWall, LandMaskGrid grid, List<ProjectedPoint> projected) {
        if (projected.size() < LOOKBACK_MIN + 1) {
            return;
        }
        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        if (shouldCloseEndpointLoop(projected)) {
            paintBoundaryRouteSegment(routeWall, grid, last, first);
        }
    }

    private void paintDetectedLoopClosures(boolean[] routeWall,
                                           LandMaskGrid grid,
                                           List<double[]> points,
                                           List<ProjectedPoint> projected,
                                           List<DetectedPolygon> loops) {
        for (DetectedPolygon loop : loops) {
            List<double[]> loopPoints = loop.points();
            if (loopPoints == null || loopPoints.size() < 2) {
                continue;
            }
            int startIndex = indexOfPoint(points, loopPoints.get(0), 0);
            int endIndex = indexOfPoint(points, loopPoints.get(loopPoints.size() - 1), Math.max(0, startIndex + 1));
            if (startIndex >= 0 && endIndex >= 0 && startIndex < projected.size() && endIndex < projected.size()) {
                paintBoundaryRouteSegment(routeWall, grid, projected.get(endIndex), projected.get(startIndex));
            }
        }
    }

    private static boolean shouldCloseEndpointLoop(List<ProjectedPoint> projected) {
        if (projected == null || projected.size() < LOOKBACK_MIN + 1) {
            return false;
        }

        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        return projectedDistance(first, last) <= CLOSE_DISTANCE_METERS
                && hasMeaningfulProjectedLoopInterior(projected);
    }

    private static boolean hasMeaningfulProjectedLoopInterior(List<ProjectedPoint> projected) {
        double areaSquareMeters = projectedShoelaceAreaSqMeters(projected);
        if (!Double.isFinite(areaSquareMeters) || areaSquareMeters < MIN_AREA_SQ_METERS) {
            return false;
        }
        double pathDistanceMeters = projectedPathDistanceMeters(projected);
        return pathDistanceMeters > 0.0
                && areaSquareMeters / pathDistanceMeters >= MIN_LOOP_INTERIOR_WIDTH_METERS;
    }

    private static double projectedPathDistanceMeters(List<ProjectedPoint> projected) {
        if (projected == null || projected.size() < 2) {
            return 0.0;
        }
        double total = 0.0;
        for (int i = 1; i < projected.size(); i += 1) {
            total += projectedDistance(projected.get(i - 1), projected.get(i));
        }
        return total;
    }

    private static boolean hasConcreteBoundarySampling(List<ProjectedPoint> projected) {
        if (projected == null || projected.size() < MIN_LAND_MASK_ROUTE_POINTS) {
            return false;
        }
        for (int i = 1; i < projected.size(); i += 1) {
            if (projectedDistance(projected.get(i - 1), projected.get(i)) > MAX_LAND_MASK_ROUTE_SEGMENT_METERS) {
                return false;
            }
        }
        return true;
    }

    private static double projectedShoelaceAreaSqMeters(List<ProjectedPoint> projected) {
        if (projected == null || projected.size() < 3) {
            return 0.0;
        }
        double sum = 0.0;
        for (int i = 0; i < projected.size(); i += 1) {
            ProjectedPoint a = projected.get(i);
            ProjectedPoint b = projected.get((i + 1) % projected.size());
            sum += a.x * b.y - b.x * a.y;
        }
        return Math.abs(sum) / 2.0;
    }

    private static List<InteriorRegion> enclosedInteriorRegions(boolean[] routeWall, LandMaskGrid grid) {
        if (routeWall == null || grid.totalCells() <= 0) {
            return List.of();
        }
        boolean[] outside = new boolean[grid.totalCells()];
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int x = 0; x < grid.width; x += 1) {
            enqueueOutsideCell(queue, outside, routeWall, grid, x, 0);
            enqueueOutsideCell(queue, outside, routeWall, grid, x, grid.height - 1);
        }
        for (int y = 1; y + 1 < grid.height; y += 1) {
            enqueueOutsideCell(queue, outside, routeWall, grid, 0, y);
            enqueueOutsideCell(queue, outside, routeWall, grid, grid.width - 1, y);
        }

        int[] dx = {1, -1, 0, 0};
        int[] dy = {0, 0, 1, -1};
        while (!queue.isEmpty()) {
            int index = queue.removeFirst();
            int y = index / grid.width;
            int x = index - y * grid.width;
            for (int i = 0; i < dx.length; i += 1) {
                enqueueOutsideCell(queue, outside, routeWall, grid, x + dx[i], y + dy[i]);
            }
        }

        boolean[] visited = new boolean[grid.totalCells()];
        List<InteriorRegion> regions = new ArrayList<>();
        for (int index = 0; index < grid.totalCells(); index += 1) {
            if (routeWall[index] || outside[index] || visited[index]) {
                continue;
            }
            InteriorRegion region = collectInteriorRegion(index, visited, routeWall, outside, grid);
            if (region != null && !region.cellIndexes().isEmpty()) {
                regions.add(region);
            }
        }
        return regions;
    }

    private static void enqueueOutsideCell(ArrayDeque<Integer> queue,
                                           boolean[] outside,
                                           boolean[] wall,
                                           LandMaskGrid grid,
                                           int x,
                                           int y) {
        if (!grid.inBounds(x, y)) {
            return;
        }
        int index = grid.index(x, y);
        if (wall[index] || outside[index]) {
            return;
        }
        outside[index] = true;
        queue.addLast(index);
    }

    private static InteriorRegion collectInteriorRegion(int startIndex,
                                                        boolean[] visited,
                                                        boolean[] routeWall,
                                                        boolean[] outside,
                                                        LandMaskGrid grid) {
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        List<Integer> cellIndexes = new ArrayList<>();
        queue.addLast(startIndex);
        visited[startIndex] = true;

        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        int boundaryEdges = 0;
        int[] dx = {1, -1, 0, 0};
        int[] dy = {0, 0, 1, -1};

        while (!queue.isEmpty()) {
            int index = queue.removeFirst();
            cellIndexes.add(index);
            int y = index / grid.width;
            int x = index - y * grid.width;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            for (int i = 0; i < dx.length; i += 1) {
                int nextX = x + dx[i];
                int nextY = y + dy[i];
                if (!grid.inBounds(nextX, nextY)) {
                    boundaryEdges += 1;
                    continue;
                }
                int nextIndex = grid.index(nextX, nextY);
                if (routeWall[nextIndex]) {
                    boundaryEdges += 1;
                    continue;
                }
                if (outside[nextIndex] || visited[nextIndex]) {
                    continue;
                }
                visited[nextIndex] = true;
                queue.addLast(nextIndex);
            }
        }

        if (cellIndexes.isEmpty()) {
            return null;
        }
        return new InteriorRegion(cellIndexes, minX, maxX, minY, maxY, boundaryEdges);
    }

    private static boolean isMeaningfulInteriorRegion(InteriorRegion region,
                                                      double routeDistanceMeters,
                                                      LandMaskGrid grid) {
        if (region == null || region.cellIndexes().isEmpty()) {
            return false;
        }
        double areaSquareMeters = region.cellIndexes().size() * grid.cellMeters * grid.cellMeters;
        if (!Double.isFinite(areaSquareMeters) || areaSquareMeters < MIN_AREA_SQ_METERS) {
            return false;
        }
        double widthMeters = (region.maxX() - region.minX() + 1) * grid.cellMeters;
        double heightMeters = (region.maxY() - region.minY() + 1) * grid.cellMeters;
        if (Math.min(widthMeters, heightMeters) < MIN_INTERIOR_REGION_WIDTH_METERS) {
            return false;
        }
        double perimeterMeters = Math.max(grid.cellMeters, region.boundaryEdges() * grid.cellMeters);
        if (areaSquareMeters / perimeterMeters < MIN_INTERIOR_REGION_WIDTH_METERS) {
            return false;
        }
        return routeDistanceMeters <= 0.0
                || areaSquareMeters / routeDistanceMeters >= MIN_LOOP_INTERIOR_WIDTH_METERS * 0.35;
    }

    private static boolean[] territoryCellsFromAcceptedInterior(boolean[] acceptedInterior,
                                                                boolean[] routeWall,
                                                                LandMaskGrid grid) {
        boolean[] claimedLand = new boolean[grid.totalCells()];
        int[] dx = {1, -1, 0, 0};
        int[] dy = {0, 0, 1, -1};
        for (int index = 0; index < grid.totalCells(); index += 1) {
            if (!acceptedInterior[index]) {
                continue;
            }
            claimedLand[index] = true;
            int y = index / grid.width;
            int x = index - y * grid.width;
            for (int i = 0; i < dx.length; i += 1) {
                int nextX = x + dx[i];
                int nextY = y + dy[i];
                if (!grid.inBounds(nextX, nextY)) {
                    continue;
                }
                int nextIndex = grid.index(nextX, nextY);
                if (routeWall[nextIndex]) {
                    claimedLand[nextIndex] = true;
                }
            }
        }
        return claimedLand;
    }

    private static boolean hasClaimedCells(boolean[] claimedLand) {
        if (claimedLand == null) {
            return false;
        }
        for (boolean value : claimedLand) {
            if (value) {
                return true;
            }
        }
        return false;
    }

    private static int indexOfPoint(List<double[]> points, double[] target, int start) {
        if (points == null || target == null || target.length < 2) {
            return -1;
        }
        for (int i = Math.max(0, start); i < points.size(); i += 1) {
            double[] point = points.get(i);
            if (point != null
                    && point.length >= 2
                    && Double.compare(point[0], target[0]) == 0
                    && Double.compare(point[1], target[1]) == 0) {
                return i;
            }
        }
        return -1;
    }

    private static void paintBoundaryRoutePoint(boolean[] routeWall, LandMaskGrid grid, ProjectedPoint point) {
        int centerX = grid.toGridX(point.x);
        int centerY = grid.toGridY(point.y);
        if (grid.inBounds(centerX, centerY)) {
            routeWall[grid.index(centerX, centerY)] = true;
        }
        double paintRadius = Math.min(grid.cellMeters * 0.45, LAND_MASK_BOUNDARY_RADIUS_METERS);
        int radiusCells = Math.max(1, (int) Math.ceil((paintRadius + grid.cellMeters * 0.5) / grid.cellMeters));
        for (int y = centerY - radiusCells; y <= centerY + radiusCells; y += 1) {
            for (int x = centerX - radiusCells; x <= centerX + radiusCells; x += 1) {
                if (!grid.inBounds(x, y)) {
                    continue;
                }
                ProjectedPoint center = grid.centerOf(x, y);
                if (projectedDistance(center, point) <= paintRadius) {
                    routeWall[grid.index(x, y)] = true;
                }
            }
        }
    }

    private static double projectedDistance(ProjectedPoint a, ProjectedPoint b) {
        double dx = a.x - b.x;
        double dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private static ProjectedPoint project(double lat, double lng, double refLat, double refLng, double cosLat) {
        double x = (lng - refLng) * cosLat * METERS_PER_DEG_LAT;
        double y = (lat - refLat) * METERS_PER_DEG_LAT;
        return new ProjectedPoint(x, y);
    }

    private static double[] unproject(ProjectedPoint point, double refLat, double refLng, double cosLat) {
        double lat = refLat + point.y / METERS_PER_DEG_LAT;
        double lng = refLng + point.x / (cosLat * METERS_PER_DEG_LAT);
        return new double[]{lat, lng};
    }

    private static List<ProjectedPoint> downsample(List<ProjectedPoint> points, int maxPoints) {
        if (points.size() <= maxPoints) {
            return points;
        }
        List<ProjectedPoint> result = new ArrayList<>(maxPoints + 1);
        double step = (points.size() - 1.0) / (maxPoints - 1.0);
        for (int i = 0; i < maxPoints; i += 1) {
            result.add(points.get((int) Math.round(i * step)));
        }
        return result;
    }

    private static List<ProjectedPoint> convexHull(List<ProjectedPoint> points) {
        List<ProjectedPoint> sorted = points.stream()
                .sorted((a, b) -> {
                    int xCompare = Double.compare(a.x, b.x);
                    return xCompare != 0 ? xCompare : Double.compare(a.y, b.y);
                })
                .toList();
        if (sorted.size() <= 1) {
            return sorted;
        }

        List<ProjectedPoint> lower = new ArrayList<>();
        for (ProjectedPoint point : sorted) {
            while (lower.size() >= 2
                    && cross(lower.get(lower.size() - 2), lower.get(lower.size() - 1), point) <= 0) {
                lower.remove(lower.size() - 1);
            }
            lower.add(point);
        }

        List<ProjectedPoint> upper = new ArrayList<>();
        for (int i = sorted.size() - 1; i >= 0; i -= 1) {
            ProjectedPoint point = sorted.get(i);
            while (upper.size() >= 2
                    && cross(upper.get(upper.size() - 2), upper.get(upper.size() - 1), point) <= 0) {
                upper.remove(upper.size() - 1);
            }
            upper.add(point);
        }

        lower.remove(lower.size() - 1);
        upper.remove(upper.size() - 1);
        lower.addAll(upper);
        return lower;
    }

    private static double cross(ProjectedPoint origin, ProjectedPoint a, ProjectedPoint b) {
        return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
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

    public static String encodeMaskCells(List<MaskCell> cells, double cellMeters) {
        return encodeMaskCells(cells, cellMeters, TerritoryMaskKind.LAND);
    }

    public static String encodeMaskCells(List<MaskCell> cells, double cellMeters, TerritoryMaskKind kind) {
        StringBuilder sb = new StringBuilder();
        TerritoryMaskKind effectiveKind = kind == null ? TerritoryMaskKind.LAND : kind;
        sb.append(LAND_MASK_PREFIX)
                .append(effectiveKind.storageValue())
                .append(':')
                .append(round3(cellMeters))
                .append('|');
        for (int i = 0; i < cells.size(); i += 1) {
            if (i > 0) {
                sb.append(';');
            }
            MaskCell cell = cells.get(i);
            sb.append(round6(cell.latitude())).append(',').append(round6(cell.longitude()));
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
        if (encoded.startsWith(LAND_MASK_ANY_PREFIX)) {
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

    public static DecodedTerritoryMask decodeMaskCells(String encoded) {
        if (encoded == null || encoded.isBlank() || !encoded.startsWith(LAND_MASK_PREFIX)) {
            return DecodedTerritoryMask.unprocessed();
        }

        int kindSeparator = encoded.indexOf(':', LAND_MASK_PREFIX.length());
        int payloadSeparator = encoded.indexOf('|', LAND_MASK_PREFIX.length());
        if (kindSeparator < 0 || payloadSeparator < 0 || kindSeparator >= payloadSeparator) {
            return DecodedTerritoryMask.unprocessed();
        }

        TerritoryMaskKind kind = TerritoryMaskKind.fromStorageValue(
                encoded.substring(LAND_MASK_PREFIX.length(), kindSeparator)
        );
        if (kind == null) {
            return DecodedTerritoryMask.unprocessed();
        }

        double cellMeters = LAND_MASK_CELL_METERS;
        try {
            cellMeters = Double.parseDouble(encoded.substring(kindSeparator + 1, payloadSeparator));
        } catch (NumberFormatException ignored) {
            // Fall back to the current default below.
        }

        List<MaskCell> cells = new ArrayList<>();
        String payload = encoded.substring(payloadSeparator + 1);
        if (!payload.isBlank()) {
            int start = 0;
            while (start < payload.length()) {
                int end = payload.indexOf(';', start);
                if (end < 0) {
                    end = payload.length();
                }
                int comma = payload.indexOf(',', start);
                if (comma > start && comma < end) {
                    String latValue = payload.substring(start, comma).trim();
                    String lngValue = payload.substring(comma + 1, end).trim();
                    if (!latValue.isBlank() && !lngValue.isBlank()) {
                        try {
                            double lat = Double.parseDouble(latValue);
                            double lng = Double.parseDouble(lngValue);
                            cells.add(new MaskCell(lat, lng));
                        } catch (NumberFormatException ignored) {
                            // Skip malformed cell.
                        }
                    }
                }
                start = end + 1;
            }
        }
        return new DecodedTerritoryMask(cells, cellMeters, kind, true);
    }

    public static int countMaskCells(String encoded) {
        if (encoded == null || encoded.isBlank() || !encoded.startsWith(LAND_MASK_PREFIX)) {
            return 0;
        }

        int payloadSeparator = encoded.indexOf('|', LAND_MASK_PREFIX.length());
        if (payloadSeparator < 0 || payloadSeparator >= encoded.length() - 1) {
            return 0;
        }

        String payload = encoded.substring(payloadSeparator + 1);
        int count = 0;
        int start = 0;
        while (start < payload.length()) {
            int end = payload.indexOf(';', start);
            if (end < 0) {
                end = payload.length();
            }
            int comma = payload.indexOf(',', start);
            if (comma > start && comma < end) {
                try {
                    Double.parseDouble(payload.substring(start, comma).trim());
                    Double.parseDouble(payload.substring(comma + 1, end).trim());
                    count += 1;
                } catch (NumberFormatException ignored) {
                    // Skip malformed cell.
                }
            }
            start = end + 1;
        }
        return count;
    }

    private static double round6(double v) {
        return Math.round(v * 1_000_000.0) / 1_000_000.0;
    }

    private static double round3(double v) {
        return Math.round(v * 1_000.0) / 1_000.0;
    }

    /**
     * Value type returned by {@link #detectLoops}.
     */
    public record DetectedPolygon(List<double[]> points, double areaSquareMeters) {}

    public record DetectedTerritoryMask(
            List<MaskCell> cells,
            double cellMeters,
            double areaSquareMeters,
            TerritoryMaskKind kind
    ) {
        public boolean isLandTerritory() {
            return kind == TerritoryMaskKind.LAND;
        }
    }

    public record DecodedTerritoryMask(
            List<MaskCell> cells,
            double cellMeters,
            TerritoryMaskKind kind,
            boolean processed
    ) {
        static DecodedTerritoryMask unprocessed() {
            return new DecodedTerritoryMask(List.of(), LAND_MASK_CELL_METERS, null, false);
        }

        public boolean isLandTerritory() {
            return processed && kind == TerritoryMaskKind.LAND;
        }

        public boolean isRouteCorridor() {
            return processed && kind == TerritoryMaskKind.ROUTE_CORRIDOR;
        }
    }

    public record MaskCell(double latitude, double longitude) {}

    public enum TerritoryMaskKind {
        LAND("land"),
        ROUTE_CORRIDOR("route-corridor");

        private final String storageValue;

        TerritoryMaskKind(String storageValue) {
            this.storageValue = storageValue;
        }

        public String storageValue() {
            return storageValue;
        }

        static TerritoryMaskKind fromStorageValue(String value) {
            if (value == null) {
                return null;
            }
            for (TerritoryMaskKind kind : values()) {
                if (kind.storageValue.equalsIgnoreCase(value.trim())) {
                    return kind;
                }
            }
            return null;
        }
    }

    private record ProjectedPoint(double x, double y) {}

    private record LoopCandidate(int startIndex, int endIndex, List<double[]> points, double areaSquareMeters) {}

    private record InteriorRegion(
            List<Integer> cellIndexes,
            int minX,
            int maxX,
            int minY,
            int maxY,
            int boundaryEdges
    ) {}

    private record LandMaskGrid(double originX, double originY, double cellMeters, int width, int height) {
        static LandMaskGrid forProjected(List<ProjectedPoint> points) {
            return forProjected(points, LAND_MASK_CELL_METERS);
        }

        static LandMaskGrid forProjected(List<ProjectedPoint> points, double preferredCellMeters) {
            double minX = Double.POSITIVE_INFINITY;
            double maxX = Double.NEGATIVE_INFINITY;
            double minY = Double.POSITIVE_INFINITY;
            double maxY = Double.NEGATIVE_INFINITY;
            for (ProjectedPoint point : points) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }

            double cellMeters = Math.max(2.0, preferredCellMeters);
            while (estimatedCellCount(maxX - minX, maxY - minY, cellMeters) > MAX_LAND_MASK_GRID_CELLS) {
                cellMeters *= 1.25;
            }

            double originX = minX - LAND_MASK_GRID_PADDING_CELLS * cellMeters;
            double originY = minY - LAND_MASK_GRID_PADDING_CELLS * cellMeters;
            int width = Math.max(3, (int) Math.ceil((maxX - minX) / cellMeters) + LAND_MASK_GRID_PADDING_CELLS * 2 + 1);
            int height = Math.max(3, (int) Math.ceil((maxY - minY) / cellMeters) + LAND_MASK_GRID_PADDING_CELLS * 2 + 1);
            return new LandMaskGrid(originX, originY, cellMeters, width, height);
        }

        private static int estimatedCellCount(double widthMeters, double heightMeters, double cellMeters) {
            int width = Math.max(3, (int) Math.ceil(widthMeters / cellMeters) + LAND_MASK_GRID_PADDING_CELLS * 2 + 1);
            int height = Math.max(3, (int) Math.ceil(heightMeters / cellMeters) + LAND_MASK_GRID_PADDING_CELLS * 2 + 1);
            return width * height;
        }

        int totalCells() {
            return width * height;
        }

        boolean inBounds(int x, int y) {
            return x >= 0 && y >= 0 && x < width && y < height;
        }

        int index(int x, int y) {
            return y * width + x;
        }

        int toGridX(double x) {
            return (int) Math.floor((x - originX) / cellMeters);
        }

        int toGridY(double y) {
            return (int) Math.floor((y - originY) / cellMeters);
        }

        ProjectedPoint centerOf(int x, int y) {
            return new ProjectedPoint(originX + (x + 0.5) * cellMeters, originY + (y + 0.5) * cellMeters);
        }
    }
}
