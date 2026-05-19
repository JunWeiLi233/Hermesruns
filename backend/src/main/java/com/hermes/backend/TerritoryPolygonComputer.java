package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
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

    /** Route-footprint buffer used when a run does not form a true closed loop. */
    static final double ROUTE_FOOTPRINT_BUFFER_METERS = 45.0;

    /** Concrete map-mask resolution. Smaller values keep single-line conquest close to the actual route. */
    static final double LAND_MASK_CELL_METERS = 8.0;

    /** Painted route thickness: open routes claim a road-like strip; closed loops still fill the enclosed land. */
    static final double LAND_MASK_ROUTE_RADIUS_METERS = 6.0;

    /** Hard cap so long rural runs do not create unbounded in-memory masks. */
    private static final int MAX_LAND_MASK_GRID_CELLS = 24_000;

    private static final int LAND_MASK_GRID_PADDING_CELLS = 4;

    private static final int MIN_LAND_MASK_CELLS = 4;

    private static final String LAND_MASK_ANY_PREFIX = "mask:";

    // Bumped from v5 -> v6 when the route-painter and loop interior-fill algorithms changed:
    // any row written by the older brush left wall gaps on adaptive grids (visible as a route
    // "breaking into pieces" on the map). Decoding now treats every "mask:v5:..." row as empty so
    // the backfill scheduler recomputes it with the current algorithm.
    private static final String LAND_MASK_PREFIX = "mask:v6:";

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
     * <p>This deliberately avoids "find a polygon" geometry. The route is painted onto a metre grid as a
     * boundary/wall, outside cells are flood-filled from the grid edge, and every remaining trapped cell
     * becomes conquered land. Open routes naturally claim only their painted route corridor because the
     * outside flood can still reach both sides of the line.</p>
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

        LandMaskGrid grid = LandMaskGrid.forProjected(projected);
        if (grid.totalCells() <= 0) {
            return List.of();
        }

        boolean[] routeWall = new boolean[grid.totalCells()];
        for (int i = 1; i < projected.size(); i += 1) {
            paintRouteSegment(routeWall, grid, projected.get(i - 1), projected.get(i));
        }
        paintEndpointClosure(routeWall, grid, projected);

        List<DetectedPolygon> detectedLoops = detectLoops(points);
        paintDetectedLoopClosures(routeWall, grid, points, projected, detectedLoops);
        fillDetectedLoopInteriors(routeWall, grid, points, projected, detectedLoops);
        fillEndpointClosureInterior(routeWall, grid, projected);

        boolean[] outside = floodOutside(grid, routeWall);
        List<MaskCell> cells = new ArrayList<>();
        for (int y = 0; y < grid.height; y += 1) {
            for (int x = 0; x < grid.width; x += 1) {
                int index = grid.index(x, y);
                if (!routeWall[index] && outside[index]) {
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
        List<double[]> result = new ArrayList<>();
        if (rawPoints == null) {
            return result;
        }

        double[] previous = null;
        for (double[] point : rawPoints) {
            if (point == null || point.length < 2) {
                continue;
            }
            double lat = point[0];
            double lng = point[1];
            if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
                continue;
            }
            if (previous == null || distanceMeters(previous[0], previous[1], lat, lng) >= MIN_ROUTE_POINT_SPACING_METERS) {
                double[] cleaned = new double[]{lat, lng};
                result.add(cleaned);
                previous = cleaned;
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
        if (projectedDistance(first, last) <= CLOSE_DISTANCE_METERS) {
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
            int endIndex = indexOfPoint(points, loopPoints.get(loopPoints.size() - 1), Math.max(0, startIndex));
            if (startIndex >= 0 && endIndex >= 0 && startIndex < projected.size() && endIndex < projected.size()) {
                paintRouteSegment(routeWall, grid, projected.get(endIndex), projected.get(startIndex));
            }
        }
    }

    /**
     * Scanline-fills the interior of every detected closed sub-loop directly onto the route wall.
     *
     * <p>This is the definitive fix for "I ran a loop but the inside is not occupied." The flood-fill
     * approach relies on the painted wall being airtight; even a one-cell gap lets the outside leak in
     * and leaves the interior unmarked. By rasterising the polygon interior explicitly we no longer
     * depend on flood-fill robustness for loop-enclosed area.</p>
     */
    private void fillDetectedLoopInteriors(boolean[] routeWall,
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
            int endIndex = indexOfPoint(points, loopPoints.get(loopPoints.size() - 1), Math.max(0, startIndex));
            if (startIndex < 0 || endIndex <= startIndex + 1 || endIndex >= projected.size()) {
                continue;
            }
            List<ProjectedPoint> polygon = new ArrayList<>(endIndex - startIndex + 1);
            for (int i = startIndex; i <= endIndex; i += 1) {
                polygon.add(projected.get(i));
            }
            fillPolygonInterior(routeWall, grid, polygon);
        }
    }

    /**
     * If the route starts and ends within {@link #CLOSE_DISTANCE_METERS} of each other, treat the
     * whole route as a closed polygon and scanline-fill its interior. Handles the exact A->B->C->D->A
     * case the user described where {@link #detectLoops} may yield a loop spanning the whole route,
     * and also safely no-ops for out-and-back routes because the resulting polygon has zero
     * even-odd interior.
     */
    private static void fillEndpointClosureInterior(boolean[] routeWall,
                                                    LandMaskGrid grid,
                                                    List<ProjectedPoint> projected) {
        if (projected.size() < LOOKBACK_MIN + 1) {
            return;
        }
        ProjectedPoint first = projected.get(0);
        ProjectedPoint last = projected.get(projected.size() - 1);
        if (projectedDistance(first, last) > CLOSE_DISTANCE_METERS) {
            return;
        }
        fillPolygonInterior(routeWall, grid, projected);
    }

    /**
     * Scanline rasterises the interior of a closed polygon (using the even-odd rule) into the route
     * wall grid. Self-intersecting polygons are handled by the standard even-odd parity logic, so
     * degenerate (zero-area) traces such as out-and-back paths add no interior cells.
     */
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
        // Scale the disk brush with the grid resolution so the painted wall stays at least one cell
        // thick on either side of the route. This keeps closed loops sealed (no flood-fill leak into
        // the interior) when LandMaskGrid adapts cellMeters upward for large bounding boxes.
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

    private static boolean[] floodOutside(LandMaskGrid grid, boolean[] routeWall) {
        boolean[] outside = new boolean[routeWall.length];
        Deque<Integer> queue = new ArrayDeque<>();

        for (int x = 0; x < grid.width; x += 1) {
            seedOutside(grid, routeWall, outside, queue, x, 0);
            seedOutside(grid, routeWall, outside, queue, x, grid.height - 1);
        }
        for (int y = 1; y < grid.height - 1; y += 1) {
            seedOutside(grid, routeWall, outside, queue, 0, y);
            seedOutside(grid, routeWall, outside, queue, grid.width - 1, y);
        }

        int[] dx = {1, -1, 0, 0};
        int[] dy = {0, 0, 1, -1};
        while (!queue.isEmpty()) {
            int index = queue.removeFirst();
            int x = index % grid.width;
            int y = index / grid.width;
            for (int i = 0; i < dx.length; i += 1) {
                seedOutside(grid, routeWall, outside, queue, x + dx[i], y + dy[i]);
            }
        }
        return outside;
    }

    private static void seedOutside(LandMaskGrid grid,
                                    boolean[] routeWall,
                                    boolean[] outside,
                                    Deque<Integer> queue,
                                    int x,
                                    int y) {
        if (!grid.inBounds(x, y)) {
            return;
        }
        int index = grid.index(x, y);
        if (routeWall[index] || outside[index]) {
            return;
        }
        outside[index] = true;
        queue.addLast(index);
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
            String[] pairs = payload.split(";");
            for (String pair : pairs) {
                if (pair.isBlank()) continue;
                String[] parts = pair.split(",", 2);
                if (parts.length != 2) continue;
                try {
                    double lat = Double.parseDouble(parts[0].trim());
                    double lng = Double.parseDouble(parts[1].trim());
                    cells.add(new MaskCell(lat, lng));
                } catch (NumberFormatException ignored) {
                    // Skip malformed cell.
                }
            }
        }
        return new DecodedTerritoryMask(cells, cellMeters);
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
