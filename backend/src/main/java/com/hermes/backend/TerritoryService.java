package com.hermes.backend;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TerritoryService {

    private static final Logger log = LoggerFactory.getLogger(TerritoryService.class);

    private static final int MAX_TERRITORY_SAMPLES = 25_000;
    private static final double CELL_DEGREES = 0.0065;
    private static final double APPROX_CELL_AREA_KM2 = 0.52;
    private static final String ACTIVE_COLOR = "#f07561";
    private static final String[] RIVAL_COLORS = {
            "#5b9cf5", "#86efac", "#fbbf24", "#c084fc", "#38bdf8", "#fb7185"
    };
    private static final double ACTIVITY_PASS_BONUS = 2.5;
    private static final double FRESH_ROUTE_BONUS = 2.0;
    private static final double WARM_ROUTE_BONUS = 1.0;
    private static final double CONTEST_RATIO = 0.68;
    private static final double CAPTURE_RATIO = 1.05;
    private static final double SECURE_RATIO = 1.22;
    private static final double MIN_CONTEST_SCORE = 4.0;
    private static final String POLYGON_CACHE_NAMESPACE = "territory-polygons";
    private static final String POLYGON_CACHE_VERSION = "land-mask-union-v10-continuous-loop-fill";
    private static final Duration POLYGON_CACHE_TTL = Duration.ofMinutes(20);
    private static final Duration POLYGON_WARMING_CACHE_TTL = Duration.ofSeconds(8);
    private static final int MIN_TERRITORY_ROUTE_POINTS = 8;
    private static final int MAX_RESPONSE_MASK_CELLS = 200_000;
    private static final int RESPONSE_MASK_CLOSE_RADIUS_CELLS = 1;
    private static final int MAX_RESPONSE_ROUTE_TRACES = 180;
    private static final int MAX_RESPONSE_ROUTE_TRACE_POINTS = 30_000;
    private static final int MAX_ROUTE_TRACE_POINTS_PER_ACTIVITY = 1_500;
    private static final String TERRITORY_MAP_CACHE_NAMESPACE = "territory-map";
    private static final String TERRITORY_MAP_CACHE_VERSION = "territory-map-v5-continuous-loop-fill";
    private static final Duration TERRITORY_MAP_CACHE_TTL = Duration.ofMinutes(2);

    private final ActivityPointRepository activityPointRepository;
    private final TerritoryPolygonRepository territoryPolygonRepository;
    private final TerritoryPolygonComputer polygonComputer;
    private final ActivityRepository activityRepository;
    private final RunnerRepository runnerRepository;
    private final TtlCacheStore cacheStore;
    private final TransactionTemplate transactionTemplate;
    private final ConcurrentMap<Long, Object> polygonResponseLocks = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, String> polygonBackfillInFlight = new ConcurrentHashMap<>();
    private final ExecutorService polygonBackfillExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "territory-polygon-backfill");
        thread.setDaemon(true);
        return thread;
    });

    public TerritoryService(ActivityPointRepository activityPointRepository,
                            TerritoryPolygonRepository territoryPolygonRepository,
                            TerritoryPolygonComputer polygonComputer,
                            ActivityRepository activityRepository,
                            RunnerRepository runnerRepository,
                            TtlCacheStore cacheStore,
                            PlatformTransactionManager transactionManager) {
        this.activityPointRepository = activityPointRepository;
        this.territoryPolygonRepository = territoryPolygonRepository;
        this.polygonComputer = polygonComputer;
        this.activityRepository = activityRepository;
        this.runnerRepository = runnerRepository;
        this.cacheStore = cacheStore;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @PreDestroy
    void shutdownPolygonBackfillExecutor() {
        polygonBackfillExecutor.shutdownNow();
    }

    // -----------------------------------------------------------------------
    // Polygon detection API
    // -----------------------------------------------------------------------

    /**
     * Detects closed-loop polygons for a single activity and persists any new ones.
     * Called from ActivityIngestedEventListenerComponent synchronously inside the ingestion transaction.
     * Exceptions are caught by the caller; this method propagates them.
     */
    @Transactional
    public void computePolygonsForActivity(Long activityId) {
        if (activityId == null) return;

        Activity activity = activityRepository.findById(activityId).orElse(null);
        if (activity == null || activity.getRunner() == null) return;

        Long userId = activity.getRunner().getId();
        evictPolygonResponseCache(userId);
        evictTerritoryMapCache(userId);

        List<Object[]> rawPoints = activityPointRepository.findLatLngByActivityIdOrdered(activityId);
        if (rawPoints == null || rawPoints.isEmpty()) return;

        List<double[]> points = new ArrayList<>(rawPoints.size());
        for (Object[] row : rawPoints) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            double lat = ((Number) row[0]).doubleValue();
            double lng = ((Number) row[1]).doubleValue();
            if (Double.isFinite(lat) && Double.isFinite(lng)) {
                points.add(new double[]{lat, lng});
            }
        }

        List<TerritoryPolygonComputer.DetectedTerritoryMask> territories = polygonComputer.detectTerritoryMasks(points);
        territoryPolygonRepository.deleteByActivityId(activityId);
        for (TerritoryPolygonComputer.DetectedTerritoryMask territory : territories) {
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(userId);
            polygon.setActivityId(activityId);
            polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(territory.cells(), territory.cellMeters()));
            polygon.setAreaSquareMeters(territory.areaSquareMeters());
            territoryPolygonRepository.save(polygon);
        }
    }

    /**
     * One-shot backfill for all activities belonging to a user.
     * Skips activities that already have polygons computed.
     * Intended for admin or manual invocation only — no scheduled trigger.
     */
    @Transactional
    public void backfillPolygonsForUser(Long userId) {
        if (userId == null) return;

        // We need a Runner reference to look up activities; retrieve one from the DB.
        // Use a simple JPQL-friendly approach: find all activities by runner id.
        List<Activity> activities = activityRepository.findAll().stream()
                .filter(a -> a.getRunner() != null && userId.equals(a.getRunner().getId()))
                .sorted(Comparator.comparing(a -> {
                    LocalDateTime t = a.getStartTime() != null ? a.getStartTime() : a.getCreatedAt();
                    return t == null ? LocalDateTime.MIN : t;
                }))
                .toList();

        for (Activity activity : activities) {
            if (hasLandMaskForActivity(activity.getId())) {
                continue; // already processed
            }
            try {
                computePolygonsForActivity(activity.getId());
            } catch (Exception e) {
                log.warn("backfillPolygonsForUser: failed to compute polygons for activity {}: {}",
                        activity.getId(), e.getMessage());
            }
        }
    }

    /**
     * Returns the concrete land-mask response for the authenticated user.
     * Every run is eligible because territory conquest is cumulative, not a recent-runs preview.
     */
    @Transactional
    public PolygonResponse buildPolygonResponse(Long userId) {
        if (userId == null) {
            return new PolygonResponse(List.of(), 0.0, 0, false, 0);
        }

        String activitySignature = globalPolygonActivitySignature(userId);
        PolygonResponse cached = readCachedPolygonResponse(userId, activitySignature);
        if (cached != null) {
            return cached;
        }

        Object lock = polygonResponseLocks.computeIfAbsent(userId, ignored -> new Object());
        synchronized (lock) {
            cached = readCachedPolygonResponse(userId, activitySignature);
            if (cached != null) {
                return cached;
            }

            List<TerritoryPolygon> activeRows = territoryPolygonRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
            List<TerritoryPolygon> liveRows = territoryPolygonRepository.findAllLiveLandMasksOrderByActivityTimeDesc();
            List<TerritoryPolygon> relevantRows = relevantLiveLandMaskRows(liveRows, userId);
            List<Long> missingActivityIds = new ArrayList<>(findMissingPolygonActivityIds(userId, activeRows));
            for (Long rivalActivityId : findMissingLocalTerritoryRivalActivityIds(userId, liveRows)) {
                if (!missingActivityIds.contains(rivalActivityId)) {
                    missingActivityIds.add(rivalActivityId);
                }
            }
            boolean warming = !missingActivityIds.isEmpty();

            PolygonResponse response = toPolygonResponse(relevantRows, userId, warming, missingActivityIds.size());
            cacheStore.put(
                    POLYGON_CACHE_NAMESPACE,
                    polygonCacheKey(userId),
                    new CachedPolygonResponse(POLYGON_CACHE_VERSION, activitySignature, response),
                    warming ? POLYGON_WARMING_CACHE_TTL : POLYGON_CACHE_TTL
            );
            scheduleMissingPolygonBackfill(userId, missingActivityIds);
            return response;
        }
    }

    private PolygonResponse toPolygonResponse(List<TerritoryPolygon> rows, Long activeUserId, boolean backfillInProgress, int pendingActivityCount) {
        List<OwnedLandMask> masks = ownedLandMasks(rows, activeUserId);
        if (masks.isEmpty()) {
            return new PolygonResponse(List.of(), 0.0, 0, backfillInProgress, pendingActivityCount);
        }

        List<PolygonDto> dtos = masks.stream()
                .map(mask -> new PolygonDto(
                        mask.id(),
                        mask.activityId(),
                        mask.ownerId(),
                        mask.ownerName(),
                        mask.color(),
                        mask.active(),
                        mask.areaSquareMeters(),
                        List.of(),
                        mask.cells(),
                        "land-mask",
                        mask.cellMeters(),
                        mask.createdAt(),
                        mask.active() ? buildRouteTraces(rows.stream()
                                .filter(row -> activeUserId != null && activeUserId.equals(row.getUserId()))
                                .toList()) : List.of()
                ))
                .toList();
        double totalArea = masks.stream().mapToDouble(OwnedLandMask::areaSquareMeters).sum();
        return new PolygonResponse(dtos, totalArea, dtos.size(), backfillInProgress, pendingActivityCount);
    }

    private List<RouteTraceDto> buildRouteTraces(List<TerritoryPolygon> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        List<RouteTraceDto> traces = new ArrayList<>();
        Set<Long> activityIds = new HashSet<>();
        int remainingPoints = MAX_RESPONSE_ROUTE_TRACE_POINTS;
        for (TerritoryPolygon row : rows) {
            if (row == null || row.getActivityId() == null || !activityIds.add(row.getActivityId())) {
                continue;
            }
            if (traces.size() >= MAX_RESPONSE_ROUTE_TRACES || remainingPoints < 2) {
                break;
            }
            TerritoryPolygonComputer.DecodedTerritoryMask mask =
                    TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (mask.cells().isEmpty()) {
                continue;
            }

            int pointLimit = Math.min(MAX_ROUTE_TRACE_POINTS_PER_ACTIVITY, remainingPoints);
            List<RoutePointDto> points = routeTracePointsForActivity(row.getActivityId(), pointLimit);
            if (points.size() < 2) {
                continue;
            }
            traces.add(new RouteTraceDto(
                    row.getActivityId(),
                    points,
                    TerritoryPolygonComputer.LAND_MASK_ROUTE_RADIUS_METERS,
                    timestampForResponse(row.getCreatedAt())
            ));
            remainingPoints -= points.size();
        }
        return traces;
    }

    private List<RoutePointDto> routeTracePointsForActivity(Long activityId, int maxPoints) {
        if (activityId == null || maxPoints < 2) {
            return List.of();
        }
        List<Object[]> rows = activityPointRepository.findLatLngByActivityIdOrdered(activityId);
        List<RoutePointDto> points = new ArrayList<>(rows == null ? 0 : rows.size());
        if (rows == null) {
            return points;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            double latitude = ((Number) row[0]).doubleValue();
            double longitude = ((Number) row[1]).doubleValue();
            if (Double.isFinite(latitude) && Double.isFinite(longitude)) {
                points.add(new RoutePointDto(round6(latitude), round6(longitude)));
            }
        }
        if (points.size() <= maxPoints) {
            return points;
        }
        return downsampleRouteTrace(points, maxPoints);
    }

    private static List<RoutePointDto> downsampleRouteTrace(List<RoutePointDto> points, int maxPoints) {
        if (points == null || points.size() <= maxPoints) {
            return points == null ? List.of() : points;
        }
        List<RoutePointDto> sampled = new ArrayList<>(maxPoints);
        double step = (points.size() - 1.0) / (maxPoints - 1.0);
        for (int i = 0; i < maxPoints; i += 1) {
            sampled.add(points.get((int) Math.round(i * step)));
        }
        return sampled;
    }

    private List<TerritoryPolygon> relevantLiveLandMaskRows(List<TerritoryPolygon> rows, Long activeUserId) {
        if (rows == null || rows.isEmpty() || activeUserId == null) {
            return List.of();
        }

        return rows.stream()
                .filter(Objects::nonNull)
                .filter(row -> row.getUserId() != null)
                .toList();
    }

    private List<OwnedLandMask> ownedLandMasks(List<TerritoryPolygon> rows, Long activeUserId) {
        List<DecodedLandMaskRow> decodedRows = new ArrayList<>();
        int sourceCellCount = 0;
        double sourceCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        for (TerritoryPolygon row : rows) {
            TerritoryPolygonComputer.DecodedTerritoryMask mask = TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (mask.cells().isEmpty()) {
                continue;
            }
            decodedRows.add(new DecodedLandMaskRow(row, mask));
            sourceCellCount += mask.cells().size();
            sourceCellMeters = Math.min(sourceCellMeters, mask.cellMeters());
        }
        if (decodedRows.isEmpty() || sourceCellCount == 0) {
            return List.of();
        }

        double responseCellMeters = responseCellMetersFor(sourceCellCount, sourceCellMeters);
        double refLat = decodedRows.get(0).mask().cells().get(0).latitude();
        double cosRef = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosRef) < 1e-6) {
            return List.of();
        }

        Map<Long, PolygonOwner> owners = polygonOwners(decodedRows, activeUserId);
        Map<Long, Map<String, MaskAccumulator>> cellsByOwner = new LinkedHashMap<>();
        Map<Long, Integer> rowCountByOwner = new HashMap<>();
        Map<Long, TerritoryPolygon> newestRowByOwner = new HashMap<>();
        Set<String> claimedCells = new HashSet<>();

        for (DecodedLandMaskRow decoded : decodedRows) {
            TerritoryPolygon row = decoded.row();
            PolygonOwner owner = owners.get(row.getUserId());
            if (owner == null) {
                continue;
            }
            rowCountByOwner.merge(row.getUserId(), 1, Integer::sum);
            newestRowByOwner.putIfAbsent(row.getUserId(), row);
            Map<String, MaskAccumulator> ownerCells = cellsByOwner.computeIfAbsent(row.getUserId(), ignored -> new LinkedHashMap<>());
            for (TerritoryPolygonComputer.MaskCell cell : decoded.mask().cells()) {
                if (!Double.isFinite(cell.latitude()) || !Double.isFinite(cell.longitude())) {
                    continue;
                }
                MaskGridPoint point = responseCellPoint(cell.latitude(), cell.longitude(), responseCellMeters, cosRef);
                if (!claimedCells.add(point.key())) {
                    continue;
                }
                ownerCells.computeIfAbsent(point.key(), ignored -> new MaskAccumulator(point.x(), point.y()))
                        .record(cell.latitude(), cell.longitude());
            }
        }

        List<OwnedLandMask> masks = new ArrayList<>();
        for (Map.Entry<Long, Map<String, MaskAccumulator>> entry : cellsByOwner.entrySet()) {
            Long ownerId = entry.getKey();
            Map<String, MaskAccumulator> ownerCells = entry.getValue();
            if (ownerCells.isEmpty()) {
                continue;
            }
            fillInteriorVoids(ownerCells, responseCellMeters, cosRef, claimedCells);
            List<MaskCellDto> cellDtos = ownerCells.values().stream()
                    .map(MaskAccumulator::toDto)
                    .toList();
            PolygonOwner owner = owners.get(ownerId);
            TerritoryPolygon newestRow = newestRowByOwner.get(ownerId);
            int sourceRows = rowCountByOwner.getOrDefault(ownerId, 0);
            masks.add(new OwnedLandMask(
                    sourceRows == 1 && newestRow != null ? newestRow.getId() : null,
                    sourceRows == 1 && newestRow != null ? newestRow.getActivityId() : null,
                    ownerId,
                    owner.name(),
                    owner.color(),
                    owner.active(),
                    cellDtos,
                    responseCellMeters,
                    cellDtos.size() * responseCellMeters * responseCellMeters,
                    newestRow != null && newestRow.getCreatedAt() != null ? newestRow.getCreatedAt().toString() : null
            ));
        }
        return masks;
    }

    private Map<Long, PolygonOwner> polygonOwners(List<DecodedLandMaskRow> rows, Long activeUserId) {
        Set<Long> userIds = new HashSet<>();
        for (DecodedLandMaskRow row : rows) {
            userIds.add(row.row().getUserId());
        }
        Map<Long, Runner> runnersById = new HashMap<>();
        runnerRepository.findAllById(userIds).forEach(runner -> runnersById.put(runner.getId(), runner));

        Map<Long, PolygonOwner> owners = new LinkedHashMap<>();
        int rivalColorIndex = 0;
        for (DecodedLandMaskRow row : rows) {
            Long userId = row.row().getUserId();
            if (owners.containsKey(userId)) {
                continue;
            }
            boolean active = userId != null && userId.equals(activeUserId);
            String color = active ? ACTIVE_COLOR : RIVAL_COLORS[rivalColorIndex++ % RIVAL_COLORS.length];
            owners.put(userId, new PolygonOwner(userId, polygonOwnerName(userId, runnersById.get(userId), active), color, active));
        }
        return owners;
    }

    private static String polygonOwnerName(Long userId, Runner runner, boolean active) {
        if (active) {
            return "You";
        }
        if (runner != null && runner.getDisplayName() != null && !runner.getDisplayName().isBlank()) {
            return runner.getDisplayName().trim();
        }
        if (runner != null && runner.getStravaUsername() != null && !runner.getStravaUsername().isBlank()) {
            return runner.getStravaUsername().trim();
        }
        if (runner != null && runner.getEmail() != null && !runner.getEmail().isBlank()) {
            return runner.getEmail().split("@")[0];
        }
        return "Runner #" + userId;
    }

    private UnionedLandMask unionLandMaskRows(List<TerritoryPolygon> rows) {
        List<TerritoryPolygonComputer.MaskCell> sourceCells = new ArrayList<>();
        String newestCreatedAt = null;
        Long sourceId = null;
        Long sourceActivityId = null;
        int sourceRowCount = 0;
        double sourceCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        for (TerritoryPolygon row : rows) {
            TerritoryPolygonComputer.DecodedTerritoryMask mask = TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (mask.cells().isEmpty()) {
                continue;
            }
            sourceRowCount += 1;
            sourceId = row.getId();
            sourceActivityId = row.getActivityId();
            sourceCellMeters = Math.min(sourceCellMeters, mask.cellMeters());
            if (newestCreatedAt == null && row.getCreatedAt() != null) {
                newestCreatedAt = row.getCreatedAt().toString();
            }
            sourceCells.addAll(mask.cells());
        }

        if (sourceCells.isEmpty()) {
            return new UnionedLandMask(null, null, List.of(), sourceCellMeters, 0.0, newestCreatedAt);
        }

        double responseCellMeters = responseCellMetersFor(sourceCells.size(), sourceCellMeters);
        double refLat = sourceCells.get(0).latitude();
        double cosRef = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosRef) < 1e-6) {
            return new UnionedLandMask(null, null, List.of(), responseCellMeters, 0.0, newestCreatedAt);
        }

        Map<String, MaskAccumulator> union = new LinkedHashMap<>();
        for (TerritoryPolygonComputer.MaskCell cell : sourceCells) {
            if (!Double.isFinite(cell.latitude()) || !Double.isFinite(cell.longitude())) {
                continue;
            }
            MaskGridPoint point = responseCellPoint(cell.latitude(), cell.longitude(), responseCellMeters, cosRef);
            union.computeIfAbsent(point.key(), ignored -> new MaskAccumulator(point.x(), point.y()))
                    .record(cell.latitude(), cell.longitude());
        }
        fillInteriorVoids(union, responseCellMeters, cosRef);

        List<MaskCellDto> cellDtos = union.values().stream()
                .map(MaskAccumulator::toDto)
                .toList();
        double totalArea = cellDtos.size() * responseCellMeters * responseCellMeters;
        return new UnionedLandMask(
                sourceRowCount == 1 ? sourceId : null,
                sourceRowCount == 1 ? sourceActivityId : null,
                cellDtos,
                responseCellMeters,
                totalArea,
                newestCreatedAt
        );
    }

    private static double responseCellMetersFor(int sourceCellCount, double sourceCellMeters) {
        double meters = Math.max(TerritoryPolygonComputer.LAND_MASK_CELL_METERS, sourceCellMeters);
        if (sourceCellCount <= MAX_RESPONSE_MASK_CELLS) {
            return meters;
        }
        double scale = Math.sqrt(sourceCellCount / (double) MAX_RESPONSE_MASK_CELLS);
        return Math.ceil(meters * scale);
    }

    private static String responseCellKey(double latitude, double longitude, double cellMeters, double cosRef) {
        return responseCellPoint(latitude, longitude, cellMeters, cosRef).key();
    }

    private static MaskGridPoint responseCellPoint(double latitude, double longitude, double cellMeters, double cosRef) {
        long y = Math.round(latitude * TerritoryPolygonComputer.METERS_PER_DEG_LAT / cellMeters);
        long x = Math.round(longitude * TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosRef / cellMeters);
        return new MaskGridPoint(x, y);
    }

    private static void fillInteriorVoids(Map<String, MaskAccumulator> union, double cellMeters, double cosRef) {
        fillInteriorVoids(union, cellMeters, cosRef, null);
    }

    private static void fillInteriorVoids(Map<String, MaskAccumulator> union,
                                          double cellMeters,
                                          double cosRef,
                                          Set<String> globallyClaimedCells) {
        if (union.isEmpty() || !Double.isFinite(cellMeters) || cellMeters <= 0 || Math.abs(cosRef) < 1e-6) {
            return;
        }

        long minX = Long.MAX_VALUE;
        long maxX = Long.MIN_VALUE;
        long minY = Long.MAX_VALUE;
        long maxY = Long.MIN_VALUE;
        for (MaskAccumulator cell : union.values()) {
            minX = Math.min(minX, cell.gridX);
            maxX = Math.max(maxX, cell.gridX);
            minY = Math.min(minY, cell.gridY);
            maxY = Math.max(maxY, cell.gridY);
        }

        long occupiedMinX = minX;
        long occupiedMaxX = maxX;
        long occupiedMinY = minY;
        long occupiedMaxY = maxY;
        long floodMinX = minX - RESPONSE_MASK_CLOSE_RADIUS_CELLS - 1L;
        long floodMaxX = maxX + RESPONSE_MASK_CLOSE_RADIUS_CELLS + 1L;
        long floodMinY = minY - RESPONSE_MASK_CLOSE_RADIUS_CELLS - 1L;
        long floodMaxY = maxY + RESPONSE_MASK_CLOSE_RADIUS_CELLS + 1L;
        long width = floodMaxX - floodMinX + 1;
        long height = floodMaxY - floodMinY + 1;
        if (width <= 0 || height <= 0 || width * height > MAX_RESPONSE_MASK_CELLS * 4L) {
            return;
        }

        Set<String> floodBarrier = responseFloodBarrier(union);
        Set<String> outside = new HashSet<>();
        Deque<MaskGridPoint> queue = new ArrayDeque<>();
        for (long x = floodMinX; x <= floodMaxX; x += 1) {
            seedOutsideCell(floodBarrier, outside, queue, x, floodMinY);
            seedOutsideCell(floodBarrier, outside, queue, x, floodMaxY);
        }
        for (long y = floodMinY + 1; y < floodMaxY; y += 1) {
            seedOutsideCell(floodBarrier, outside, queue, floodMinX, y);
            seedOutsideCell(floodBarrier, outside, queue, floodMaxX, y);
        }

        long[] dx = {1, -1, 0, 0};
        long[] dy = {0, 0, 1, -1};
        while (!queue.isEmpty()) {
            MaskGridPoint point = queue.removeFirst();
            for (int i = 0; i < dx.length; i += 1) {
                long nextX = point.x() + dx[i];
                long nextY = point.y() + dy[i];
                if (nextX < floodMinX || nextX > floodMaxX || nextY < floodMinY || nextY > floodMaxY) {
                    continue;
                }
                seedOutsideCell(floodBarrier, outside, queue, nextX, nextY);
            }
        }

        for (long y = occupiedMinY; y <= occupiedMaxY; y += 1) {
            for (long x = occupiedMinX; x <= occupiedMaxX; x += 1) {
                MaskGridPoint point = new MaskGridPoint(x, y);
                String key = point.key();
                if (union.containsKey(key)
                        || outside.contains(key)
                        || (globallyClaimedCells != null && globallyClaimedCells.contains(key))) {
                    continue;
                }
                long fillX = x;
                long fillY = y;
                union.computeIfAbsent(key, ignored -> new MaskAccumulator(fillX, fillY))
                        .record(responseCellLatitude(fillY, cellMeters), responseCellLongitude(fillX, cellMeters, cosRef));
                if (globallyClaimedCells != null) {
                    globallyClaimedCells.add(key);
                }
            }
        }
    }

    private static Set<String> responseFloodBarrier(Map<String, MaskAccumulator> union) {
        Set<String> barrier = new HashSet<>();
        for (MaskAccumulator cell : union.values()) {
            for (long dy = -RESPONSE_MASK_CLOSE_RADIUS_CELLS; dy <= RESPONSE_MASK_CLOSE_RADIUS_CELLS; dy += 1) {
                for (long dx = -RESPONSE_MASK_CLOSE_RADIUS_CELLS; dx <= RESPONSE_MASK_CLOSE_RADIUS_CELLS; dx += 1) {
                    barrier.add(new MaskGridPoint(cell.gridX + dx, cell.gridY + dy).key());
                }
            }
        }
        return barrier;
    }

    private static void seedOutsideCell(Set<String> blocked,
                                        Set<String> outside,
                                        Deque<MaskGridPoint> queue,
                                        long x,
                                        long y) {
        MaskGridPoint point = new MaskGridPoint(x, y);
        String key = point.key();
        if (blocked.contains(key) || !outside.add(key)) {
            return;
        }
        queue.addLast(point);
    }

    private static double responseCellLatitude(long gridY, double cellMeters) {
        return round6(gridY * cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT);
    }

    private static double responseCellLongitude(long gridX, double cellMeters, double cosRef) {
        return round6(gridX * cellMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosRef));
    }

    private static double round6(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }

    private List<Long> findMissingPolygonActivityIds(Long userId, List<TerritoryPolygon> existingRows) {
        Set<Long> alreadyComputedActivityIds = new HashSet<>();
        for (TerritoryPolygon row : existingRows) {
            if (row.getActivityId() == null) {
                continue;
            }
            TerritoryPolygonComputer.DecodedTerritoryMask mask =
                    TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (!mask.cells().isEmpty()) {
                alreadyComputedActivityIds.add(row.getActivityId());
            }
        }

        List<Long> activityIds = activityRepository.findIdsByRunnerAndActivityType(
                userId,
                ActivityType.RUN.name()
        );
        List<Long> missingActivityIds = new ArrayList<>();
        for (Long activityId : activityIds) {
            if (activityId == null || alreadyComputedActivityIds.contains(activityId)) {
                continue;
            }
            if (!isGpsQualifiedTerritoryActivity(activityId)) {
                continue;
            }
            missingActivityIds.add(activityId);
        }
        return missingActivityIds;
    }

    private List<Long> findMissingLocalTerritoryRivalActivityIds(Long activeUserId, List<TerritoryPolygon> liveRows) {
        if (activeUserId == null) {
            return List.of();
        }
        var activeRunner = runnerRepository.findById(activeUserId);
        if (activeRunner.isEmpty()
                || !LocalSharedRunnerBootstrapService.DEFAULT_EMAIL.equalsIgnoreCase(activeRunner.get().getEmail())) {
            return List.of();
        }
        var rival = runnerRepository.findByEmailIgnoreCase(LocalSharedRunnerBootstrapService.TERRITORY_RIVAL_EMAIL);
        if (rival.isEmpty()) {
            return List.of();
        }
        Long rivalId = rival.get().getId();
        List<TerritoryPolygon> rivalRows = liveRows.stream()
                .filter(row -> rivalId.equals(row.getUserId()))
                .toList();
        return findMissingPolygonActivityIds(rivalId, rivalRows);
    }

    private boolean isGpsQualifiedTerritoryActivity(Long activityId) {
        List<Object[]> rawPoints = activityPointRepository.findLatLngByActivityIdOrdered(activityId);
        int validPoints = 0;
        for (Object[] row : rawPoints) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            double lat = ((Number) row[0]).doubleValue();
            double lng = ((Number) row[1]).doubleValue();
            if (Double.isFinite(lat) && Double.isFinite(lng)) {
                validPoints += 1;
                if (validPoints >= MIN_TERRITORY_ROUTE_POINTS) {
                    return true;
                }
            }
        }
        return false;
    }

    private void scheduleMissingPolygonBackfill(Long userId, List<Long> missingActivityIds) {
        if (userId == null || missingActivityIds == null || missingActivityIds.isEmpty()) {
            return;
        }
        String claim = missingActivityIds.size() + ":" + missingActivityIds.get(0);
        if (polygonBackfillInFlight.putIfAbsent(userId, claim) != null) {
            return;
        }
        polygonBackfillExecutor.submit(() -> {
            try {
                for (Long activityId : missingActivityIds) {
                    if (activityId == null) {
                        continue;
                    }
                    try {
                        transactionTemplate.executeWithoutResult(ignored -> computePolygonsForActivity(activityId));
                    } catch (Exception e) {
                        log.warn("territory polygon warmup failed for activity {}: {}", activityId, e.getMessage());
                    }
                }
            } finally {
                evictPolygonResponseCache(userId);
                polygonBackfillInFlight.remove(userId, claim);
            }
        });
    }

    private String globalPolygonActivitySignature(Long activeUserId) {
        Object[] row = activityRepository.findGlobalActivitySetSignatureByActivityType(ActivityType.RUN);
        String polygonSignature = globalLiveLandMaskSignature();
        if (row == null || row.length == 0) {
            return "global:0:0:none|" + polygonSignature + "|active:" + polygonActivitySignature(activeUserId);
        }
        Object[] values = row;
        if (row.length == 1 && row[0] instanceof Object[] nested) {
            values = nested;
        }
        long count = numberAt(values, 0);
        long maxId = numberAt(values, 1);
        String newest = values.length > 2 && values[2] != null ? values[2].toString() : "none";
        return "global:" + count + ":" + maxId + ":" + newest + "|" + polygonSignature + "|active:" + polygonActivitySignature(activeUserId);
    }

    private String globalLiveLandMaskSignature() {
        Object[] row = territoryPolygonRepository.findGlobalLiveLandMaskSignature();
        if (row == null || row.length == 0) {
            return "polygons:0:0:none";
        }
        Object[] values = row;
        if (row.length == 1 && row[0] instanceof Object[] nested) {
            values = nested;
        }
        long count = numberAt(values, 0);
        long maxId = numberAt(values, 1);
        String newest = values.length > 2 && values[2] != null ? values[2].toString() : "none";
        return "polygons:" + count + ":" + maxId + ":" + newest;
    }

    private String polygonActivitySignature(Long userId) {
        Object[] row = activityRepository.findActivitySetSignatureByRunnerAndActivityType(userId, ActivityType.RUN);
        if (row == null || row.length == 0) {
            return "0:0:none";
        }
        Object[] values = row;
        if (row.length == 1 && row[0] instanceof Object[] nested) {
            values = nested;
        }
        long count = numberAt(values, 0);
        long maxId = numberAt(values, 1);
        String newest = values.length > 2 && values[2] != null ? values[2].toString() : "none";
        return count + ":" + maxId + ":" + newest;
    }

    private PolygonResponse readCachedPolygonResponse(Long userId, String activitySignature) {
        CachedPolygonResponse cached = cacheStore
                .get(POLYGON_CACHE_NAMESPACE, polygonCacheKey(userId), CachedPolygonResponse.class)
                .orElse(null);
        if (cached == null
                || !POLYGON_CACHE_VERSION.equals(cached.version())
                || !activitySignature.equals(cached.activitySignature())
                || cached.response() == null) {
            return null;
        }
        return cached.response();
    }

    private void evictPolygonResponseCache(Long userId) {
        if (userId != null) {
            cacheStore.evict(POLYGON_CACHE_NAMESPACE, polygonCacheKey(userId));
        }
    }

    private static String polygonCacheKey(Long userId) {
        return String.valueOf(userId);
    }

    private static long numberAt(Object[] values, int index) {
        if (values == null || values.length <= index || !(values[index] instanceof Number number)) {
            return 0L;
        }
        return number.longValue();
    }

    private boolean hasLandMaskForActivity(Long activityId) {
        if (activityId == null) {
            return false;
        }
        return territoryPolygonRepository.findByActivityId(activityId).stream()
                .map(TerritoryPolygon::getCoordinates)
                .map(TerritoryPolygonComputer::decodeMaskCells)
                .anyMatch(mask -> !mask.cells().isEmpty());
    }

    // -----------------------------------------------------------------------
    // Response records for the polygon endpoint
    // -----------------------------------------------------------------------

    public record PolygonDto(
            Long id,
            Long activityId,
            Long ownerId,
            String ownerName,
            String color,
            boolean active,
            Double areaSquareMeters,
            List<List<Double>> coordinates,
            List<MaskCellDto> cells,
            String shapeType,
            Double cellMeters,
            String createdAt,
            List<RouteTraceDto> routeTraces
    ) {}

    public record MaskCellDto(double latitude, double longitude) {}

    public record RoutePointDto(double latitude, double longitude) {}

    public record RouteTraceDto(
            Long activityId,
            List<RoutePointDto> points,
            double routeRadiusMeters,
            String createdAt
    ) {}

    private record MaskGridPoint(long x, long y) {
        String key() {
            return y + ":" + x;
        }
    }

    private static final class MaskAccumulator {
        private final long gridX;
        private final long gridY;
        private double latSum;
        private double lngSum;
        private int count;

        MaskAccumulator(long gridX, long gridY) {
            this.gridX = gridX;
            this.gridY = gridY;
        }

        void record(double latitude, double longitude) {
            latSum += latitude;
            lngSum += longitude;
            count += 1;
        }

        MaskCellDto toDto() {
            return new MaskCellDto(round6(latSum / count), round6(lngSum / count));
        }
    }

    private record UnionedLandMask(
            Long id,
            Long activityId,
            List<MaskCellDto> cells,
            double cellMeters,
            double areaSquareMeters,
            String createdAt
    ) {}

    private record OwnedLandMask(
            Long id,
            Long activityId,
            Long ownerId,
            String ownerName,
            String color,
            boolean active,
            List<MaskCellDto> cells,
            double cellMeters,
            double areaSquareMeters,
            String createdAt
    ) {}

    private record DecodedLandMaskRow(
            TerritoryPolygon row,
            TerritoryPolygonComputer.DecodedTerritoryMask mask
    ) {}

    private record PolygonOwner(
            Long id,
            String name,
            String color,
            boolean active
    ) {}

    public record PolygonResponse(
            List<PolygonDto> polygons,
            double totalAreaSquareMeters,
            int polygonCount,
            boolean backfillInProgress,
            int pendingActivityCount
    ) {}

    private record CachedPolygonResponse(
            String version,
            String activitySignature,
            PolygonResponse response
    ) {}

    private record CachedTerritoryMapResponse(
            String version,
            String activitySignature,
            TerritoryMapResponse response
    ) {}

    public TerritoryMapResponse buildTerritoryMap(Runner activeRunner) {
        if (activeRunner == null || activeRunner.getId() == null) {
            return TerritoryMapResponse.empty();
        }
        String activitySignature = territoryMapActivitySignature(activeRunner.getId());
        CachedTerritoryMapResponse cached = cacheStore
                .get(TERRITORY_MAP_CACHE_NAMESPACE, territoryMapCacheKey(activeRunner.getId()), CachedTerritoryMapResponse.class)
                .orElse(null);
        if (cached != null
                && TERRITORY_MAP_CACHE_VERSION.equals(cached.version())
                && activitySignature.equals(cached.activitySignature())
                && cached.response() != null) {
            return cached.response();
        }

        List<Object[]> rows = activityPointRepository.findTerritorySamples(
                ActivityType.RUN,
                PageRequest.of(0, MAX_TERRITORY_SAMPLES)
        );
        if (rows == null || rows.isEmpty()) {
            TerritoryMapResponse empty = TerritoryMapResponse.empty();
            cacheTerritoryMapResponse(activeRunner.getId(), activitySignature, empty);
            return empty;
        }

        Map<Long, RunnerBoard> runners = new LinkedHashMap<>();
        Map<String, CellAccumulator> cells = new HashMap<>();
        double latSum = 0.0;
        double lngSum = 0.0;
        int validSamples = 0;

        for (Object[] row : rows) {
            TerritorySample sample = TerritorySample.from(row);
            if (sample == null) {
                continue;
            }
            RunnerBoard board = runners.computeIfAbsent(
                    sample.runnerId(),
                    id -> new RunnerBoard(id, displayNameFor(sample, activeRunner), sample.runnerId().equals(activeRunner.getId()))
            );
            board.sampleCount += 1;

            String cellKey = cellKey(sample.latitude(), sample.longitude());
            CellAccumulator cell = cells.computeIfAbsent(cellKey, ignored -> new CellAccumulator(cellKey, sample.latitude(), sample.longitude()));
            cell.record(sample);

            latSum += sample.latitude();
            lngSum += sample.longitude();
            validSamples += 1;
        }

        if (validSamples == 0 || cells.isEmpty()) {
            TerritoryMapResponse empty = TerritoryMapResponse.empty();
            cacheTerritoryMapResponse(activeRunner.getId(), activitySignature, empty);
            return empty;
        }

        assignColors(runners, activeRunner.getId());

        List<TerritoryCell> territoryCells = cells.values().stream()
                .map(cell -> cell.toCell(runners, activeRunner.getId()))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(TerritoryCell::sampleCount).reversed())
                .limit(180)
                .toList();

        Map<Long, List<TerritoryCell>> cellsByOwner = new HashMap<>();
        for (TerritoryCell cell : territoryCells) {
            cellsByOwner.computeIfAbsent(cell.ownerId(), ignored -> new ArrayList<>()).add(cell);
        }

        int totalOwnedCells = territoryCells.size();
        List<TerritoryRunner> leaderboard = runners.values().stream()
                .map(board -> board.toRunner(cellsByOwner.getOrDefault(board.id, List.of()), totalOwnedCells))
                .filter(runner -> runner.cellCount() > 0 || runner.active())
                .sorted(Comparator.comparing(TerritoryRunner::areaKm2).reversed())
                .toList();

        int activeCellCount = cellsByOwner.getOrDefault(activeRunner.getId(), List.of()).size();
        int activeRank = 1;
        for (int i = 0; i < leaderboard.size(); i += 1) {
            if (leaderboard.get(i).active()) {
                activeRank = i + 1;
                break;
            }
        }

        TerritorySummary summary = new TerritorySummary(
                round(activeCellCount * APPROX_CELL_AREA_KM2, 1),
                activeCellCount,
                totalOwnedCells == 0 ? 0 : Math.round((activeCellCount * 100f) / totalOwnedCells),
                activeRank,
                leaderboard.size()
        );

        List<TerritoryZone> zones = territoryCells.stream()
                .limit(9)
                .map(cell -> TerritoryZone.from(cell, activeRunner.getId()))
                .toList();

        List<RecentCapture> recentCaptures = territoryCells.stream()
                .filter(cell -> cell.ownerId().equals(activeRunner.getId()))
                .sorted(Comparator.comparing(TerritoryCell::lastSeenAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(6)
                .map(cell -> new RecentCapture(cell.name(), formatDate(cell.lastSeenAt()), cell.sampleCount()))
                .toList();

        TerritoryTarget target = territoryCells.stream()
                .filter(cell -> !cell.ownerId().equals(activeRunner.getId()))
                .filter(cell -> cell.contested() || cell.sampleCount() >= 3)
                .sorted(Comparator.comparing(TerritoryCell::samplesToContest)
                        .thenComparing(TerritoryCell::controlPct))
                .findFirst()
                .map(cell -> new TerritoryTarget(
                        cell.name(),
                        runners.containsKey(cell.ownerId()) ? runners.get(cell.ownerId()).name : "Rival",
                        round(APPROX_CELL_AREA_KM2, 1),
                        cell.samplesToContest(),
                        targetDifficulty(cell),
                        cell.controlPct()
                ))
                .orElse(null);

        TerritoryMapResponse response = new TerritoryMapResponse(
                true,
                "live",
                new MapCenter(round(latSum / validSamples, 6), round(lngSum / validSamples, 6), 13),
                summary,
                territoryCells,
                leaderboard,
                zones,
                recentCaptures,
                target
        );
        cacheTerritoryMapResponse(activeRunner.getId(), activitySignature, response);
        return response;
    }

    private void cacheTerritoryMapResponse(Long userId, String activitySignature, TerritoryMapResponse response) {
        cacheStore.put(
                TERRITORY_MAP_CACHE_NAMESPACE,
                territoryMapCacheKey(userId),
                new CachedTerritoryMapResponse(TERRITORY_MAP_CACHE_VERSION, activitySignature, response),
                TERRITORY_MAP_CACHE_TTL
        );
    }

    private void evictTerritoryMapCache(Long userId) {
        if (userId != null) {
            cacheStore.evict(TERRITORY_MAP_CACHE_NAMESPACE, territoryMapCacheKey(userId));
        }
    }

    private static String territoryMapCacheKey(Long userId) {
        return String.valueOf(userId);
    }

    private String territoryMapActivitySignature(Long activeRunnerId) {
        Object[] row = activityRepository.findGlobalActivitySetSignatureByActivityType(ActivityType.RUN);
        if (row == null || row.length == 0) {
            return "global:0:0:none|active:" + polygonActivitySignature(activeRunnerId);
        }
        Object[] values = row;
        if (row.length == 1 && row[0] instanceof Object[] nested) {
            values = nested;
        }
        long count = numberAt(values, 0);
        long maxId = numberAt(values, 1);
        String newest = values.length > 2 && values[2] != null ? values[2].toString() : "none";
        return "global:" + count + ":" + maxId + ":" + newest + "|active:" + polygonActivitySignature(activeRunnerId);
    }

    private static String displayNameFor(TerritorySample sample, Runner activeRunner) {
        if (sample.runnerId().equals(activeRunner.getId())) {
            return "You";
        }
        if (sample.displayName() != null && !sample.displayName().isBlank()) {
            return sample.displayName().trim();
        }
        if (sample.stravaUsername() != null && !sample.stravaUsername().isBlank()) {
            return sample.stravaUsername().trim();
        }
        return "Runner #" + sample.runnerId();
    }

    private static void assignColors(Map<Long, RunnerBoard> runners, Long activeRunnerId) {
        int colorIndex = 0;
        for (RunnerBoard runner : runners.values()) {
            if (runner.id.equals(activeRunnerId)) {
                runner.color = ACTIVE_COLOR;
            } else {
                runner.color = RIVAL_COLORS[colorIndex % RIVAL_COLORS.length];
                colorIndex += 1;
            }
        }
    }

    private static String targetDifficulty(TerritoryCell cell) {
        if (cell.samplesToContest() <= 3) {
            return cell.contested() ? "Takeover" : "Soft border";
        }
        if (cell.samplesToContest() <= 7) {
            return cell.contested() ? "Frontline" : "Reachable";
        }
        return "Fortified";
    }

    private static int controlPct(double ownerScore, double challengerScore) {
        if (ownerScore <= 0.0) {
            return 0;
        }
        if (challengerScore <= 0.0) {
            return 100;
        }
        int pct = (int) Math.round((ownerScore * 100.0) / (ownerScore + challengerScore));
        return Math.max(50, Math.min(100, pct));
    }

    private static int samplesNeededToReach(double currentScore, double targetScore) {
        return Math.max(2, (int) Math.ceil(Math.max(0.0, targetScore - currentScore)));
    }

    private static String cellKey(double latitude, double longitude) {
        int latIndex = (int) Math.floor(latitude / CELL_DEGREES);
        int lngIndex = (int) Math.floor(longitude / CELL_DEGREES);
        return latIndex + ":" + lngIndex;
    }

    private static List<List<Double>> polygonFor(double centerLat, double centerLng) {
        double half = CELL_DEGREES / 2.0;
        return List.of(
                List.of(round(centerLat - half, 6), round(centerLng - half, 6)),
                List.of(round(centerLat - half, 6), round(centerLng + half, 6)),
                List.of(round(centerLat + half, 6), round(centerLng + half, 6)),
                List.of(round(centerLat + half, 6), round(centerLng - half, 6))
        );
    }

    private static String formatDate(String dateTime) {
        if (dateTime == null || dateTime.isBlank()) {
            return "RECENT";
        }
        try {
            LocalDateTime parsed = LocalDateTime.parse(dateTime);
            return parsed.getMonth().name().substring(0, 3) + " " + parsed.getDayOfMonth();
        } catch (RuntimeException ignored) {
            return "RECENT";
        }
    }

    private static String timestampForResponse(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.toString();
    }

    private static double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }

    private record TerritorySample(
            Long runnerId,
            String displayName,
            String stravaUsername,
            double latitude,
            double longitude,
            Long activityId,
            LocalDateTime seenAt
    ) {
        static TerritorySample from(Object[] row) {
            if (row == null || row.length < 7 || row[0] == null || row[3] == null || row[4] == null) {
                return null;
            }
            double latitude = ((Number) row[3]).doubleValue();
            double longitude = ((Number) row[4]).doubleValue();
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                return null;
            }
            return new TerritorySample(
                    ((Number) row[0]).longValue(),
                    row[1] == null ? null : String.valueOf(row[1]),
                    row[2] == null ? null : String.valueOf(row[2]),
                    latitude,
                    longitude,
                    row[5] == null ? null : ((Number) row[5]).longValue(),
                    row[6] instanceof LocalDateTime time ? time : null
            );
        }
    }

    private static final class RunnerBoard {
        final Long id;
        final String name;
        final boolean active;
        int sampleCount;
        String color;

        RunnerBoard(Long id, String name, boolean active) {
            this.id = id;
            this.name = name;
            this.active = active;
        }

        TerritoryRunner toRunner(List<TerritoryCell> cells, int totalCells) {
            int cellCount = cells.size();
            return new TerritoryRunner(
                    id,
                    name,
                    color,
                    active,
                    cellCount,
                    round(cellCount * APPROX_CELL_AREA_KM2, 1),
                    sampleCount,
                    totalCells == 0 ? 0 : Math.round((cellCount * 100f) / totalCells)
            );
        }
    }

    private static final class CellAccumulator {
        final String key;
        final double centerLat;
        final double centerLng;
        final Map<Long, RunnerPressure> pressureByRunner = new HashMap<>();
        LocalDateTime lastSeenAt;
        int totalSamples;

        CellAccumulator(String key, double latitude, double longitude) {
            this.key = key;
            this.centerLat = Math.floor(latitude / CELL_DEGREES) * CELL_DEGREES + CELL_DEGREES / 2.0;
            this.centerLng = Math.floor(longitude / CELL_DEGREES) * CELL_DEGREES + CELL_DEGREES / 2.0;
        }

        void record(TerritorySample sample) {
            pressureByRunner.computeIfAbsent(sample.runnerId(), ignored -> new RunnerPressure()).record(sample);
            totalSamples += 1;
            if (sample.seenAt() != null && (lastSeenAt == null || sample.seenAt().isAfter(lastSeenAt))) {
                lastSeenAt = sample.seenAt();
            }
        }

        TerritoryCell toCell(Map<Long, RunnerBoard> runners, Long activeRunnerId) {
            List<RunnerControl> controls = pressureByRunner.entrySet().stream()
                    .map(entry -> new RunnerControl(
                            entry.getKey(),
                            entry.getValue().captureScore(),
                            entry.getValue().sampleCount,
                            entry.getValue().lastSeenAt,
                            entry.getValue().latestActivityId
                    ))
                    .sorted(Comparator.comparing(RunnerControl::lastSeenAt, Comparator.nullsLast(Comparator.reverseOrder()))
                            .thenComparing(RunnerControl::latestActivityId, Comparator.nullsLast(Comparator.reverseOrder()))
                            .thenComparing(Comparator.comparing(RunnerControl::score).reversed())
                            .thenComparing(Comparator.comparing(RunnerControl::sampleCount).reversed()))
                    .toList();
            RunnerControl owner = controls.stream()
                    .findFirst()
                    .orElse(null);
            if (owner == null) {
                return null;
            }
            RunnerControl challenger = controls.stream()
                    .filter(control -> !control.runnerId().equals(owner.runnerId()))
                    .findFirst()
                    .orElse(RunnerControl.empty());
            RunnerBoard ownerBoard = runners.get(owner.runnerId());
            if (ownerBoard == null) {
                return null;
            }
            double activeScore = pressureByRunner.getOrDefault(activeRunnerId, RunnerPressure.empty()).captureScore();
            boolean activeOwns = owner.runnerId().equals(activeRunnerId);
            boolean contested = challenger.score() >= Math.max(MIN_CONTEST_SCORE, owner.score() * CONTEST_RATIO);
            double targetScore = activeOwns
                    ? (challenger.score() <= 0.0 ? owner.score() + 3.0 : challenger.score() * SECURE_RATIO)
                    : (activeScore >= owner.score() * CONTEST_RATIO ? owner.score() * CAPTURE_RATIO : owner.score() * CONTEST_RATIO);
            return new TerritoryCell(
                    key,
                    "Sector " + Math.abs(key.hashCode() % 900 + 100),
                    owner.runnerId(),
                    ownerBoard.name,
                    ownerBoard.color,
                    round(centerLat, 6),
                    round(centerLng, 6),
                    polygonFor(centerLat, centerLng),
                    totalSamples,
                    contested,
                    challenger.runnerId() == null || !runners.containsKey(challenger.runnerId()) ? null : runners.get(challenger.runnerId()).name,
                    timestampForResponse(lastSeenAt),
                    round(owner.score(), 1),
                    round(challenger.score(), 1),
                    round(activeScore, 1),
                    controlPct(owner.score(), challenger.score()),
                    samplesNeededToReach(activeScore, targetScore)
            );
        }
    }

    private static final class RunnerPressure {
        final Set<Long> activityIds = new HashSet<>();
        int sampleCount;
        LocalDateTime lastSeenAt;
        Long latestActivityId;

        static RunnerPressure empty() {
            return new RunnerPressure();
        }

        void record(TerritorySample sample) {
            sampleCount += 1;
            if (sample.activityId() != null) {
                activityIds.add(sample.activityId());
            }
            if (isNewerCoverage(sample.seenAt(), sample.activityId())) {
                lastSeenAt = sample.seenAt();
                latestActivityId = sample.activityId();
            }
        }

        private boolean isNewerCoverage(LocalDateTime seenAt, Long activityId) {
            if (seenAt == null) {
                return false;
            }
            if (lastSeenAt == null || seenAt.isAfter(lastSeenAt)) {
                return true;
            }
            return seenAt.isEqual(lastSeenAt)
                    && activityId != null
                    && (latestActivityId == null || activityId > latestActivityId);
        }

        double captureScore() {
            if (sampleCount <= 0) {
                return 0.0;
            }
            return sampleCount + activityIds.size() * ACTIVITY_PASS_BONUS + recencyBonus();
        }

        private double recencyBonus() {
            if (lastSeenAt == null) {
                return 0.0;
            }
            LocalDateTime now = LocalDateTime.now();
            if (!lastSeenAt.isBefore(now.minusDays(10))) {
                return FRESH_ROUTE_BONUS;
            }
            if (!lastSeenAt.isBefore(now.minusDays(45))) {
                return WARM_ROUTE_BONUS;
            }
            return 0.0;
        }
    }

    private record RunnerControl(
            Long runnerId,
            double score,
            int sampleCount,
            LocalDateTime lastSeenAt,
            Long latestActivityId
    ) {
        static RunnerControl empty() {
            return new RunnerControl(null, 0.0, 0, null, null);
        }
    }

    public record TerritoryMapResponse(
            boolean available,
            String mode,
            MapCenter center,
            TerritorySummary summary,
            List<TerritoryCell> territories,
            List<TerritoryRunner> leaderboard,
            List<TerritoryZone> zones,
            List<RecentCapture> recentCaptures,
            TerritoryTarget nextTarget
    ) {
        static TerritoryMapResponse empty() {
            return new TerritoryMapResponse(
                    false,
                    "empty",
                    new MapCenter(37.822, -122.25, 12),
                    new TerritorySummary(0.0, 0, 0, 0, 0),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    null
            );
        }
    }

    public record MapCenter(double latitude, double longitude, int zoom) {}

    public record TerritorySummary(double areaKm2, int cellCount, int coveragePct, int rank, int totalRunners) {}

    public record TerritoryCell(
            String id,
            String name,
            Long ownerId,
            String ownerName,
            String color,
            double centerLat,
            double centerLng,
            List<List<Double>> polygon,
            int sampleCount,
            boolean contested,
            String challengerName,
            String lastSeenAt,
            double ownerScore,
            double challengerScore,
            double activeScore,
            int controlPct,
            int samplesToContest
    ) {}

    public record TerritoryRunner(
            Long id,
            String name,
            String color,
            boolean active,
            int cellCount,
            double areaKm2,
            int sampleCount,
            int coveragePct
    ) {}

    public record TerritoryZone(
            String id,
            String name,
            String ownerName,
            String color,
            double areaKm2,
            boolean contested,
            String challengerName,
            int sampleCount,
            int controlPct,
            int samplesToContest
    ) {
        static TerritoryZone from(TerritoryCell cell, Long activeRunnerId) {
            return new TerritoryZone(
                    cell.id(),
                    cell.name(),
                    cell.ownerId().equals(activeRunnerId) ? "You" : cell.ownerName(),
                    cell.color(),
                    round(APPROX_CELL_AREA_KM2, 1),
                    cell.contested(),
                    cell.challengerName(),
                    cell.sampleCount(),
                    cell.controlPct(),
                    cell.samplesToContest()
            );
        }
    }

    public record RecentCapture(String name, String dateLabel, int sampleCount) {}

    public record TerritoryTarget(String name, String ownerName, double areaKm2, int samplesToContest, String difficulty, int controlPct) {}
}
