package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
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
    static final double CLOSE_DISTANCE_METERS = 25.0;

    /** Self-near loops must be almost exact; nearby parallel park roads are not territory closures. */
    static final double SELF_INTERSECTION_CLOSE_DISTANCE_METERS = 6.0;

    /** Minimum enclosed area in square metres to keep a loop polygon (filters jitter / turn-arounds). */
    static final double MIN_AREA_SQ_METERS = 5_000.0;

    /** Route-footprint buffer used when a run does not form a true closed loop. */
    static final double ROUTE_FOOTPRINT_BUFFER_METERS = 45.0;

    /** Concrete map-mask resolution. Smaller values keep single-line conquest close to the actual route. */
    static final double LAND_MASK_CELL_METERS = 8.0;

    /** Painted route thickness: open routes claim a road-like strip; closed loops fill enclosed land. */
    static final double LAND_MASK_ROUTE_RADIUS_METERS = 6.0;

    /**
     * A loop that closes at only one route endpoint may have a short warmup/cooldown tail, but a
     * park-scale lead-in means the run did not return to the route's original point.
     */
    private static final double MAX_ONE_ENDED_LOOP_TAIL_METERS = 180.0;

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
    private static final String LAND_MASK_PREFIX = "mask:v21:";

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

        List<DetectedPolygon> detectedLoops = detectLoops(points);
        if (detectedLoops.isEmpty() && !shouldCloseEndpointLoop(projected)) {
            return sparseOpenRouteCorridorMask(projected, refLat, refLng, cosLat);
        }

        LandMaskGrid grid = LandMaskGrid.forProjected(projected);
        if (grid.totalCells() <= 0) {
            return List.of();
        }

        boolean[] claimedLand = new boolean[grid.totalCells()];
        for (int i = 1; i < projected.size(); i += 1) {
            paintRouteSegment(claimedLand, grid, projected.get(i - 1), projected.get(i));
        }
        paintEndpointClosure(claimedLand, grid, projected);

        paintDetectedLoopClosures(claimedLand, grid, points, projected, detectedLoops);
        fillDetectedLoopWallInteriors(claimedLand, grid, points, projected, detectedLoops);
        fillEndpointClosureWallInterior(claimedLand, grid, projected);

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
        return List.of(new DetectedTerritoryMask(cells, grid.cellMeters, area));
    }

    private static List<DetectedTerritoryMask> sparseOpenRouteCorridorMask(List<ProjectedPoint> projected,
                                                                           double refLat,
                                                                           double refLng,
                                                                           double cosLat) {
        if (projected == null || projected.size() < MIN_ROUTE_FOOTPRINT_POINTS) {
            return List.of();
        }

        double cellMeters = LAND_MASK_CELL_METERS;
        Map<String, MaskCell> cellsByKey = new LinkedHashMap<>();
        for (int i = 1; i < projected.size(); i += 1) {
            paintSparseRouteSegment(cellsByKey, projected.get(i - 1), projected.get(i), cellMeters, refLat, refLng, cosLat);
        }

        if (cellsByKey.size() < MIN_LAND_MASK_CELLS) {
            return List.of();
        }

        double area = cellsByKey.size() * cellMeters * cellMeters;
        return List.of(new DetectedTerritoryMask(new ArrayList<>(cellsByKey.values()), cellMeters, area));
    }

    private static void paintSparseRouteSegment(Map<String, MaskCell> cellsByKey,
                                                ProjectedPoint start,
                                                ProjectedPoint end,
                                                double cellMeters,
                                                double refLat,
                                                double refLng,
                                                double cosLat) {
        double dx = end.x - start.x;
        double dy = end.y - start.y;
        double distance = Math.sqrt(dx * dx + dy * dy);
        int steps = Math.max(1, (int) Math.ceil(distance / Math.max(1.0, cellMeters * 0.35)));
        for (int i = 0; i <= steps; i += 1) {
            double pct = i / (double) steps;
            paintSparseRoutePoint(
                    cellsByKey,
                    new ProjectedPoint(start.x + dx * pct, start.y + dy * pct),
                    cellMeters,
                    refLat,
                    refLng,
                    cosLat
            );
        }
    }

    private static void paintSparseRoutePoint(Map<String, MaskCell> cellsByKey,
                                              ProjectedPoint point,
                                              double cellMeters,
                                              double refLat,
                                              double refLng,
                                              double cosLat) {
        long centerX = sparseGridX(point.x, cellMeters);
        long centerY = sparseGridY(point.y, cellMeters);
        addSparseMaskCell(cellsByKey, centerX, centerY, cellMeters, refLat, refLng, cosLat);

        double paintRadius = LAND_MASK_ROUTE_RADIUS_METERS;
        long radiusCells = Math.max(1L, (long) Math.ceil((paintRadius + cellMeters * 0.5) / cellMeters));
        for (long y = centerY - radiusCells; y <= centerY + radiusCells; y += 1) {
            for (long x = centerX - radiusCells; x <= centerX + radiusCells; x += 1) {
                ProjectedPoint center = sparseCellCenter(x, y, cellMeters);
                if (projectedDistance(center, point) <= paintRadius) {
                    addSparseMaskCell(cellsByKey, x, y, cellMeters, refLat, refLng, cosLat);
                }
            }
        }
    }

    private static void addSparseMaskCell(Map<String, MaskCell> cellsByKey,
                                          long gridX,
                                          long gridY,
                                          double cellMeters,
                                          double refLat,
                                          double refLng,
                                          double cosLat) {
        String key = gridX + ":" + gridY;
        if (cellsByKey.containsKey(key)) {
            return;
        }
        double[] center = unproject(sparseCellCenter(gridX, gridY, cellMeters), refLat, refLng, cosLat);
        cellsByKey.put(key, new MaskCell(round6(center[0]), round6(center[1])));
    }

    private static long sparseGridX(double x, double cellMeters) {
        return (long) Math.floor(x / cellMeters);
    }

    private static long sparseGridY(double y, double cellMeters) {
        return (long) Math.floor(y / cellMeters);
    }

    private static ProjectedPoint sparseCellCenter(long x, long y, double cellMeters) {
        return new ProjectedPoint((x + 0.5) * cellMeters, (y + 0.5) * cellMeters);
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

            if (area >= MIN_AREA_SQ_METERS && isEndpointAnchoredLoop(points, anchorIdx, i)) {
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
                if (area >= MIN_AREA_SQ_METERS && isEndpointAnchoredLoop(points, j, i)) {
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
            return routeDistanceMeters(points, Math.max(0, endIndex), pointCount - 1) <= MAX_ONE_ENDED_LOOP_TAIL_METERS;
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

    private static void paintRouteSegment(boolean[] routeWall, LandMaskGrid grid, ProjectedPoint start, ProjectedPoint end) {
        double dx = end.x - start.x;
        double dy = end.y - start.y;
        double distance = Math.sqrt(dx * dx + dy * dy);
        int steps = Math.max(1, (int) Math.ceil(distance / Math.max(1.0, grid.cellMeters * 0.35)));
        for (int i = 0; i <= steps; i += 1) {
            double pct = i / (double) steps;
            paintRoutePoint(routeWall, grid, new ProjectedPoint(start.x + dx * pct, start.y + dy * pct));
        }
    }

    private static void paintEndpointClosure(boolean[] routeWall, LandMaskGrid grid, List<ProjectedPoint> projected) {
        if (projected.size() < LOOKBACK_MIN + 1) {
            return;
        }
        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        if (shouldCloseEndpointLoop(projected)) {
            paintRouteSegment(routeWall, grid, last, first);
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
                paintRouteSegment(routeWall, grid, projected.get(endIndex), projected.get(startIndex));
            }
        }
    }

    /**
     * Flood-fills the interior of every detected closed sub-loop directly onto the claimed land mask.
     * Closed GPS loops can contain self-crossings or short interior tails; treating the route as the
     * wall and filling bounded cells preserves the concrete enclosure without using open-route walls.
     */
    private void fillDetectedLoopWallInteriors(boolean[] routeWall,
                                               LandMaskGrid grid,
                                               List<double[]> points,
                                               List<ProjectedPoint> projected,
                                               List<DetectedPolygon> loops) {
        for (DetectedPolygon loop : loops) {
            List<double[]> loopPoints = loop.points();
            if (loopPoints == null || loopPoints.size() < 3) {
                continue;
            }
            int startIndex = indexOfPoint(points, loopPoints.get(0), 0);
            int endIndex = indexOfPoint(points, loopPoints.get(loopPoints.size() - 1), Math.max(0, startIndex + 1));
            if (startIndex < 0 || endIndex <= startIndex + 1 || endIndex >= projected.size()) {
                continue;
            }
            List<ProjectedPoint> polygon = new ArrayList<>(endIndex - startIndex + 1);
            for (int i = startIndex; i <= endIndex; i += 1) {
                polygon.add(projected.get(i));
            }
            fillLoopWallInterior(routeWall, grid, polygon);
        }
    }

    private static void fillEndpointClosureWallInterior(boolean[] routeWall,
                                                        LandMaskGrid grid,
                                                        List<ProjectedPoint> projected) {
        if (projected.size() < LOOKBACK_MIN + 1) {
            return;
        }
        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        if (!shouldCloseEndpointLoop(projected)) {
            return;
        }
        fillLoopWallInterior(routeWall, grid, projected);
    }

    private static boolean shouldCloseEndpointLoop(List<ProjectedPoint> projected) {
        if (projected == null || projected.size() < LOOKBACK_MIN + 1) {
            return false;
        }

        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        return projectedDistance(first, last) <= CLOSE_DISTANCE_METERS;
    }

    private static void fillLoopWallInterior(boolean[] claimedLand, LandMaskGrid grid, List<ProjectedPoint> loop) {
        int n = loop == null ? 0 : loop.size();
        if (n < 3 || grid.totalCells() <= 0) {
            return;
        }

        boolean[] wall = new boolean[grid.totalCells()];
        for (int i = 1; i < n; i += 1) {
            paintRouteSegment(wall, grid, loop.get(i - 1), loop.get(i));
        }
        paintRouteSegment(wall, grid, loop.get(n - 1), loop.get(0));

        boolean[] outside = new boolean[grid.totalCells()];
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int x = 0; x < grid.width; x += 1) {
            enqueueOutsideCell(queue, outside, wall, grid, x, 0);
            enqueueOutsideCell(queue, outside, wall, grid, x, grid.height - 1);
        }
        for (int y = 1; y + 1 < grid.height; y += 1) {
            enqueueOutsideCell(queue, outside, wall, grid, 0, y);
            enqueueOutsideCell(queue, outside, wall, grid, grid.width - 1, y);
        }

        int[] dx = {1, -1, 0, 0};
        int[] dy = {0, 0, 1, -1};
        while (!queue.isEmpty()) {
            int index = queue.removeFirst();
            int y = index / grid.width;
            int x = index - y * grid.width;
            for (int i = 0; i < dx.length; i += 1) {
                enqueueOutsideCell(queue, outside, wall, grid, x + dx[i], y + dy[i]);
            }
        }

        for (int i = 0; i < wall.length; i += 1) {
            if (wall[i] || !outside[i]) {
                claimedLand[i] = true;
            }
        }
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

    private static void fillPolygonInterior(boolean[] routeWall, LandMaskGrid grid, List<ProjectedPoint> poly) {
        int n = poly.size();
        if (n < 3) {
            return;
        }

        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (ProjectedPoint p : poly) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        int gyStart = Math.max(0, grid.toGridY(minY));
        int gyEnd = Math.min(grid.height - 1, grid.toGridY(maxY));

        List<Double> intersections = new ArrayList<>();
        for (int gy = gyStart; gy <= gyEnd; gy += 1) {
            double rayY = grid.originY + (gy + 0.5) * grid.cellMeters;
            intersections.clear();
            for (int i = 0; i < n; i += 1) {
                ProjectedPoint a = poly.get(i);
                ProjectedPoint b = poly.get((i + 1) % n);
                boolean aAbove = a.y > rayY;
                boolean bAbove = b.y > rayY;
                if (aAbove == bAbove) {
                    continue;
                }
                double dy = b.y - a.y;
                if (dy == 0.0) {
                    continue;
                }
                double t = (rayY - a.y) / dy;
                intersections.add(a.x + t * (b.x - a.x));
            }
            if (intersections.size() < 2) {
                continue;
            }
            Collections.sort(intersections);
            for (int k = 0; k + 1 < intersections.size(); k += 2) {
                int gxStart = Math.max(0, grid.toGridX(intersections.get(k)));
                int gxEnd = Math.min(grid.width - 1, grid.toGridX(intersections.get(k + 1)));
                for (int gx = gxStart; gx <= gxEnd; gx += 1) {
                    routeWall[grid.index(gx, gy)] = true;
                }
            }
        }
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

    private static void paintRoutePoint(boolean[] routeWall, LandMaskGrid grid, ProjectedPoint point) {
        int centerX = grid.toGridX(point.x);
        int centerY = grid.toGridY(point.y);
        // Always mark the cell containing the route point. Guarantees a contiguous corridor along the
        // route even when the adaptive grid cellMeters grows large enough that the disk brush below
        // would otherwise miss neighbours of the point's own cell, which previously caused long
        // routes to "break down into pieces" on the rendered map.
        if (grid.inBounds(centerX, centerY)) {
            routeWall[grid.index(centerX, centerY)] = true;
        }
        // Scale the disk brush with the grid resolution so the painted corridor stays at least one
        // cell thick on either side of the route when LandMaskGrid adapts cellMeters upward.
        double paintRadius = Math.max(LAND_MASK_ROUTE_RADIUS_METERS, grid.cellMeters * 0.75);
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
        StringBuilder sb = new StringBuilder();
        sb.append(LAND_MASK_PREFIX).append(round3(cellMeters)).append('|');
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
            return new DecodedTerritoryMask(List.of(), LAND_MASK_CELL_METERS);
        }

        int payloadSeparator = encoded.indexOf('|', LAND_MASK_PREFIX.length());
        if (payloadSeparator < 0) {
            return new DecodedTerritoryMask(List.of(), LAND_MASK_CELL_METERS);
        }

        double cellMeters = LAND_MASK_CELL_METERS;
        try {
            cellMeters = Double.parseDouble(encoded.substring(LAND_MASK_PREFIX.length(), payloadSeparator));
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
        return new DecodedTerritoryMask(cells, cellMeters);
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

    public record DetectedTerritoryMask(List<MaskCell> cells, double cellMeters, double areaSquareMeters) {}

    public record DecodedTerritoryMask(List<MaskCell> cells, double cellMeters) {}

    public record MaskCell(double latitude, double longitude) {}

    private record ProjectedPoint(double x, double y) {}

    private record LoopCandidate(int startIndex, int endIndex, List<double[]> points, double areaSquareMeters) {}

    private record LandMaskGrid(double originX, double originY, double cellMeters, int width, int height) {
        static LandMaskGrid forProjected(List<ProjectedPoint> points) {
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

            double cellMeters = LAND_MASK_CELL_METERS;
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
