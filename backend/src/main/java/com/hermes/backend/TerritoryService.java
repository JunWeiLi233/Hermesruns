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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
public class TerritoryService {

    private static final Logger log = LoggerFactory.getLogger(TerritoryService.class);

    private static final int MAX_TERRITORY_SAMPLES = 25_000;
    private static final double CELL_DEGREES = 0.0065;
    private static final double APPROX_CELL_AREA_KM2 = 0.52;
    private static final String ACTIVE_COLOR = "#f07561";
    private static final String[] RIVAL_COLORS = {
            "#5b9cf5", "#fbbf24", "#86efac", "#c084fc", "#38bdf8", "#fb7185"
    };
    private static final double ACTIVITY_PASS_BONUS = 2.5;
    private static final double FRESH_ROUTE_BONUS = 2.0;
    private static final double WARM_ROUTE_BONUS = 1.0;
    private static final double CONTEST_RATIO = 0.68;
    private static final double CAPTURE_RATIO = 1.05;
    private static final double SECURE_RATIO = 1.22;
    private static final double MIN_CONTEST_SCORE = 4.0;
    private static final String POLYGON_CACHE_NAMESPACE = "territory-polygons";
    private static final String POLYGON_CACHE_VERSION = "land-mask-union-v54-mask-v30-concrete-boundary-sampling";
    private static final Duration POLYGON_CACHE_TTL = Duration.ofMinutes(20);
    private static final Duration POLYGON_WARMING_CACHE_TTL = Duration.ofSeconds(45);
    private static final int MIN_TERRITORY_ROUTE_POINTS = 8;
    private static final int MAX_RESPONSE_MASK_CELLS = 200_000;
    private static final int LARGE_LAND_MASK_SOURCE_CELL_COUNT = 10_000;
    private static final double LARGE_LAND_MASK_RESPONSE_CELL_METERS = 16.0;
    private static final double MAX_REAL_USER_LAND_MASK_RESPONSE_CELL_METERS = 16.0;
    private static final int MAX_COARSE_LAND_MASK_RESPONSE_CELLS = 1_250_000;
    private static final int INITIAL_GLOBAL_POLYGON_MAX_OWNERS = 96;
    private static final double COARSE_LAND_MASK_CELL_METERS = 128.0;
    private static final int MAX_TERRITORY_ROUTE_TRACES = 256;
    private static final int MAX_TERRITORY_ROUTE_TRACE_POINTS = 180;
    private static final double TERRITORY_ROUTE_TRACE_RADIUS_METERS = 18.0;
    private static final String TERRITORY_MAP_CACHE_NAMESPACE = "territory-map";
    private static final String TERRITORY_MAP_CACHE_VERSION = "territory-map-v25-activity-split-render";
    private static final Duration TERRITORY_MAP_CACHE_TTL = Duration.ofMinutes(15);
    private static final int SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT = 4;
    private static final int GLOBAL_SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT = 96;
    private static final int GLOBAL_POLYGON_WARMUP_SCAN_LIMIT = 512;

    private final ActivityPointRepository activityPointRepository;
    private final TerritoryPolygonRepository territoryPolygonRepository;
    private final TerritoryPolygonComputer polygonComputer;
    private final ActivityRepository activityRepository;
    private final RunnerRepository runnerRepository;
    private final TtlCacheStore cacheStore;
    private volatile long lastGlobalSignatureTimestamp;
    private volatile String cachedGlobalSignature;
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
        if (territories.isEmpty()) {
            TerritoryPolygon marker = new TerritoryPolygon();
            marker.setUserId(userId);
            marker.setActivityId(activityId);
            marker.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                    List.of(),
                    TerritoryPolygonComputer.LAND_MASK_CELL_METERS,
                    TerritoryPolygonComputer.TerritoryMaskKind.LAND
            ));
            marker.setAreaSquareMeters(0.0);
            territoryPolygonRepository.save(marker);
            return;
        }
        for (TerritoryPolygonComputer.DetectedTerritoryMask territory : territories) {
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(userId);
            polygon.setActivityId(activityId);
            polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                    territory.cells(),
                    territory.cellMeters(),
                    territory.kind()
            ));
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
        return buildPolygonResponse(userId, true);
    }

    /**
     * Returns the concrete land-mask response for the authenticated user.
     * When {@code includeCells} is false, cells and routeTraces are omitted from
     * every polygon — useful when the caller already has a valid render cache.
     */
    @Transactional
    public PolygonResponse buildPolygonResponse(Long userId, boolean includeCells) {
        if (userId == null) {
            return new PolygonResponse(List.of(), 0.0, 0, false, 0);
        }

        String activitySignature = globalPolygonActivitySignature(userId);
        PolygonResponse cached = readCachedPolygonResponse(userId, activitySignature);
        if (cached != null) {
            return includeCells ? cached : stripCells(cached);
        }

        Object lock = polygonResponseLocks.computeIfAbsent(userId, ignored -> new Object());
        synchronized (lock) {
            cached = readCachedPolygonResponse(userId, activitySignature);
            if (cached != null) {
                return includeCells ? cached : stripCells(cached);
            }

            boolean localSharedRunner = isLocalSharedRunner(userId);
            List<TerritoryPolygon> activeRows = territoryPolygonRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
            List<TerritoryPolygon> liveRows = territoryPolygonRepository.findAllLiveLandMasksOrderByActivityTimeDesc();
            List<Long> missingOwnActivityIds = findMissingPolygonActivityIds(userId, activeRows);
            if (!missingOwnActivityIds.isEmpty()) {
                List<Long> synchronousWarmupActivityIds = localSharedRunner
                        ? missingOwnActivityIds
                        : missingOwnActivityIds.stream().limit(SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT).toList();
                computeMissingPolygonsSynchronously(synchronousWarmupActivityIds);
                activeRows = territoryPolygonRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
                liveRows = territoryPolygonRepository.findAllLiveLandMasksOrderByActivityTimeDesc();
                missingOwnActivityIds = findMissingPolygonActivityIds(userId, activeRows);
            }
            List<Long> missingGlobalActivityIds = findMissingGlobalPolygonActivityIds(userId);
            if (!missingGlobalActivityIds.isEmpty()) {
                computeMissingPolygonsSynchronously(missingGlobalActivityIds.stream()
                        .limit(GLOBAL_SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT)
                        .toList());
                activeRows = territoryPolygonRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
                liveRows = territoryPolygonRepository.findAllLiveLandMasksOrderByActivityTimeDesc();
                missingOwnActivityIds = findMissingPolygonActivityIds(userId, activeRows);
                missingGlobalActivityIds = findMissingGlobalPolygonActivityIds(userId);
            }
            List<TerritoryPolygon> relevantRows = relevantLiveLandMaskRows(liveRows, userId);
            List<Long> missingActivityIds = new ArrayList<>(missingOwnActivityIds);
            appendMissingActivityIds(missingActivityIds, missingGlobalActivityIds);
            boolean warming = !missingActivityIds.isEmpty();

            PolygonResponse response = toPolygonResponse(relevantRows, userId, warming, missingActivityIds.size(), true);
            cacheStore.put(
                    POLYGON_CACHE_NAMESPACE,
                    polygonCacheKey(userId),
                    new CachedPolygonResponse(POLYGON_CACHE_VERSION, activitySignature, response),
                    warming ? POLYGON_WARMING_CACHE_TTL : POLYGON_CACHE_TTL
            );
            scheduleMissingPolygonBackfill(userId, missingActivityIds);
            return includeCells ? response : stripCells(response);
        }
    }

    public PolygonResponse toInitialGlobalPolygonResponse(PolygonResponse response) {
        if (response == null || response.polygons() == null || response.polygons().isEmpty()
                || response.polygons().size() <= INITIAL_GLOBAL_POLYGON_MAX_OWNERS) {
            return response;
        }

        List<PolygonDtoInfo> polygonInfos = new ArrayList<>();
        for (int index = 0; index < response.polygons().size(); index += 1) {
            PolygonDto polygon = response.polygons().get(index);
            PolygonDtoBounds bounds = polygonDtoBounds(polygon);
            if (bounds != null) {
                polygonInfos.add(new PolygonDtoInfo(polygon, index, bounds, Double.POSITIVE_INFINITY));
            }
        }

        List<PolygonDtoInfo> activeInfos = polygonInfos.stream()
                .filter(info -> info.polygon().active())
                .toList();
        if (activeInfos.isEmpty()) {
            return new PolygonResponse(
                    response.polygons().stream().limit(INITIAL_GLOBAL_POLYGON_MAX_OWNERS).toList(),
                    response.totalAreaSquareMeters(),
                    response.polygonCount(),
                    response.backfillInProgress(),
                    response.pendingActivityCount()
            );
        }

        PolygonDtoBounds activeBounds = activeInfos.stream()
                .map(PolygonDtoInfo::bounds)
                .reduce(null, TerritoryService::mergePolygonDtoBounds);
        if (activeBounds == null) {
            return response;
        }

        Set<Long> activeOwnerIds = new HashSet<>();
        activeInfos.forEach(info -> activeOwnerIds.add(info.polygon().ownerId()));
        List<PolygonDtoInfo> rankedRivals = polygonInfos.stream()
                .filter(info -> !activeOwnerIds.contains(info.polygon().ownerId()))
                .map(info -> info.withDistance(polygonDtoBoundsDistanceMeters(activeBounds, info.bounds())))
                .sorted(Comparator
                        .comparingDouble(PolygonDtoInfo::distanceMeters)
                        .thenComparing((PolygonDtoInfo info) -> -safeDouble(info.polygon().areaSquareMeters()))
                        .thenComparingInt(PolygonDtoInfo::index))
                .toList();
        int rivalLimit = Math.max(0, INITIAL_GLOBAL_POLYGON_MAX_OWNERS - activeOwnerIds.size());
        List<PolygonDtoInfo> selectedInfos = new ArrayList<>();
        selectedInfos.addAll(activeInfos);
        selectedInfos.addAll(rankedRivals.stream()
                .limit(rivalLimit)
                .toList());
        selectedInfos.sort(Comparator.comparingInt(PolygonDtoInfo::index));

        return new PolygonResponse(
                selectedInfos.stream().map(PolygonDtoInfo::polygon).toList(),
                response.totalAreaSquareMeters(),
                response.polygonCount(),
                response.backfillInProgress(),
                response.pendingActivityCount()
        );
    }

    @Transactional(readOnly = true)
    public String territoryMapSignature(Long runnerId) {
        if (runnerId == null) {
            return TERRITORY_MAP_CACHE_VERSION + "|global:0:0:none|active:0:0:none";
        }
        return TERRITORY_MAP_CACHE_VERSION + "|" + territoryMapActivitySignature(runnerId);
    }

    @Transactional(readOnly = true)
    public String polygonResponseSignature(Long userId) {
        if (userId == null) {
            return POLYGON_CACHE_VERSION + "|global:0:0:none|polygons:0:0:none|active:0:0:none";
        }
        return POLYGON_CACHE_VERSION + "|" + globalPolygonActivitySignature(userId);
    }

    private PolygonResponse toPolygonResponse(List<TerritoryPolygon> rows,
                                              Long activeUserId,
                                              boolean backfillInProgress,
                                              int pendingActivityCount,
                                              boolean includeCells) {
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
                        includeCells ? mask.cells() : List.of(),
                        "land-mask",
                        mask.cellMeters(),
                        mask.createdAt(),
                        includeCells ? routeTracesFor(mask) : List.of()
                ))
                .toList();
        double totalArea = masks.stream().mapToDouble(OwnedLandMask::areaSquareMeters).sum();
        return new PolygonResponse(dtos, totalArea, dtos.size(), backfillInProgress, pendingActivityCount);
    }

    private List<TerritoryPolygon> relevantLiveLandMaskRows(List<TerritoryPolygon> rows, Long activeUserId) {
        if (rows == null || rows.isEmpty() || activeUserId == null) {
            return List.of();
        }

        Set<Long> userIds = rows.stream()
                .filter(Objects::nonNull)
                .map(TerritoryPolygon::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Runner> runnersById = new HashMap<>();
        runnerRepository.findAllById(userIds).forEach(runner -> runnersById.put(runner.getId(), runner));

        return rows.stream()
                .filter(Objects::nonNull)
                .filter(row -> row.getUserId() != null)
                .filter(row -> row.getUserId().equals(activeUserId)
                        || !isLocalTerritoryFixtureRunner(runnersById.get(row.getUserId())))
                .toList();
    }

    private static boolean isLocalTerritoryFixtureRunner(Runner runner) {
        if (runner == null || runner.getEmail() == null) {
            return false;
        }
        String email = runner.getEmail().trim().toLowerCase(Locale.ROOT);
        return email.endsWith("@hermes.local") && email.startsWith("territory-");
    }

    private boolean isLocalSharedRunner(Long userId) {
        if (userId == null) {
            return false;
        }
        return runnerRepository.findById(userId)
                .map(Runner::getEmail)
                .filter(email -> LocalSharedRunnerBootstrapService.DEFAULT_EMAIL.equalsIgnoreCase(email))
                .isPresent();
    }

    private void computeMissingPolygonsSynchronously(List<Long> activityIds) {
        for (Long activityId : activityIds) {
            if (activityId == null) {
                continue;
            }
            try {
                computePolygonsForActivity(activityId);
            } catch (Exception e) {
                log.warn("territory shared-runner polygon warmup failed for activity {}: {}", activityId, e.getMessage());
            }
        }
    }

    private List<OwnedLandMask> ownedLandMasks(List<TerritoryPolygon> rows, Long activeUserId) {
        List<DecodedLandMaskRow> decodedRows = new ArrayList<>();
        int sourceCellCount = 0;
        double sourceCellMeters = Double.POSITIVE_INFINITY;
        for (TerritoryPolygon row : rows) {
            TerritoryPolygonComputer.DecodedTerritoryMask mask = TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (!isRenderableTerritoryMask(mask)) {
                continue;
            }
            decodedRows.add(new DecodedLandMaskRow(row, mask));
            sourceCellCount += mask.cells().size();
            sourceCellMeters = Math.min(sourceCellMeters, mask.cellMeters());
        }
        if (decodedRows.isEmpty() || sourceCellCount == 0) {
            return List.of();
        }
        if (!Double.isFinite(sourceCellMeters) || sourceCellMeters <= 0.0) {
            sourceCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        }

        Map<Long, LocalDateTime> activityTimes = effectiveActivityTimes(decodedRows);
        double responseCellMeters = responseCellMetersFor(sourceCellCount, sourceCellMeters);
        double refLat = decodedRows.get(0).mask().cells().get(0).latitude();
        double cosRef = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosRef) < 1e-6) {
            return List.of();
        }

        Map<Long, PolygonOwner> owners = polygonOwners(decodedRows, activeUserId);
        Map<String, Map<OwnerActivityKey, MaskCellClaim>> claimsByCell = new LinkedHashMap<>();
        Map<OwnerActivityKey, Integer> rowCountBySource = new HashMap<>();
        Map<OwnerActivityKey, TerritoryPolygon> newestRowBySource = new HashMap<>();
        Map<OwnerActivityKey, List<Long>> routeActivityIdsBySource = new HashMap<>();
        Map<Long, Integer> ownerOrder = new HashMap<>();

        for (DecodedLandMaskRow decoded : decodedRows) {
            TerritoryPolygon row = decoded.row();
            PolygonOwner owner = owners.get(row.getUserId());
            if (owner == null) {
                continue;
            }
            ownerOrder.putIfAbsent(row.getUserId(), ownerOrder.size());
            OwnerActivityKey sourceKey = new OwnerActivityKey(row.getUserId(), row.getActivityId());
            rowCountBySource.merge(sourceKey, 1, Integer::sum);
            LocalDateTime activityTime = ownershipTimeFor(row, activityTimes);
            TerritoryPolygon currentNewestRow = newestRowBySource.get(sourceKey);
            if (isNewerTerritoryRow(row, activityTime, currentNewestRow, ownershipTimeFor(currentNewestRow, activityTimes))) {
                newestRowBySource.put(sourceKey, row);
            }
            if (row.getActivityId() != null) {
                routeActivityIdsBySource
                        .computeIfAbsent(sourceKey, ignored -> new ArrayList<>())
                        .add(row.getActivityId());
            }
            for (TerritoryPolygonComputer.MaskCell cell : decoded.mask().cells()) {
                recordSourceCellFootprintClaims(
                        claimsByCell,
                        row,
                        cell,
                        decoded.mask().cellMeters(),
                        responseCellMeters,
                        cosRef,
                        sourceKey,
                        activityTime
                );
            }
        }

        Map<OwnerActivityKey, Map<String, MaskAccumulator>> cellsBySource = new LinkedHashMap<>();
        for (Map.Entry<String, Map<OwnerActivityKey, MaskCellClaim>> entry : claimsByCell.entrySet()) {
            Map.Entry<OwnerActivityKey, MaskCellClaim> winner = entry.getValue().entrySet().stream()
                    .max((left, right) -> MaskCellClaim.compareOwnership(left.getValue(), right.getValue()))
                    .orElse(null);
            if (winner == null) {
                continue;
            }
            OwnerActivityKey sourceKey = winner.getKey();
            cellsBySource.computeIfAbsent(sourceKey, ignored -> new LinkedHashMap<>())
                    .put(entry.getKey(), winner.getValue().accumulator);
        }

        List<OwnedLandMask> masks = new ArrayList<>();
        List<OwnerActivityKey> sourceKeys = new ArrayList<>(cellsBySource.keySet());
        sourceKeys.sort(Comparator
                .comparingInt((OwnerActivityKey key) -> ownerOrder.getOrDefault(key.ownerId(), Integer.MAX_VALUE))
                .thenComparing((OwnerActivityKey key) -> ownershipTimeFor(newestRowBySource.get(key), activityTimes), Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing((OwnerActivityKey key) -> key.activityId(), Comparator.nullsLast(Comparator.reverseOrder())));
        for (OwnerActivityKey sourceKey : sourceKeys) {
            Long ownerId = sourceKey.ownerId();
            Map<String, MaskAccumulator> ownerCells = cellsBySource.get(sourceKey);
            if (ownerId == null || ownerCells == null || ownerCells.isEmpty()) {
                continue;
            }
            List<MaskCellDto> cellDtos = ownerCells.values().stream()
                    .map(MaskAccumulator::toDto)
                    .toList();
            PolygonOwner owner = owners.get(ownerId);
            if (owner == null) {
                continue;
            }
            TerritoryPolygon newestRow = newestRowBySource.get(sourceKey);
            int sourceRows = rowCountBySource.getOrDefault(sourceKey, 0);
            List<Long> routeActivityIds = routeActivityIdsBySource.getOrDefault(sourceKey, List.of()).stream()
                    .distinct()
                    .toList();
            if (routeActivityIds.isEmpty() && sourceKey.activityId() != null) {
                routeActivityIds = List.of(sourceKey.activityId());
            }
            LocalDateTime maskTime = ownershipTimeFor(newestRow, activityTimes);
            masks.add(new OwnedLandMask(
                    sourceRows == 1 && newestRow != null ? newestRow.getId() : null,
                    sourceKey.activityId(),
                    ownerId,
                    owner.name(),
                    owner.color(),
                    owner.active(),
                    routeActivityIds,
                    cellDtos,
                    responseCellMeters,
                    cellDtos.size() * responseCellMeters * responseCellMeters,
                    maskTime != null ? maskTime.toString() : null
            ));
        }
        return masks;
    }

    private static boolean isRenderableTerritoryMask(TerritoryPolygonComputer.DecodedTerritoryMask mask) {
        return mask != null
                && mask.isLandTerritory()
                && !mask.cells().isEmpty();
    }

    private Map<Long, LocalDateTime> effectiveActivityTimes(List<DecodedLandMaskRow> rows) {
        Set<Long> activityIds = rows.stream()
                .map(DecodedLandMaskRow::row)
                .map(TerritoryPolygon::getActivityId)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll);
        return effectiveActivityTimesForIds(activityIds);
    }

    private Map<Long, LocalDateTime> effectiveActivityTimesForIds(Iterable<Long> activityIds) {
        Set<Long> uniqueActivityIds = new LinkedHashSet<>();
        if (activityIds != null) {
            for (Long activityId : activityIds) {
                if (activityId != null) {
                    uniqueActivityIds.add(activityId);
                }
            }
        }
        if (uniqueActivityIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, LocalDateTime> times = new HashMap<>();
        for (Object[] row : activityRepository.findEffectiveTimesByActivityIds(uniqueActivityIds)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            times.put(((Number) row[0]).longValue(), (LocalDateTime) row[1]);
        }
        return times;
    }

    private static LocalDateTime ownershipTimeFor(TerritoryPolygon row, Map<Long, LocalDateTime> activityTimes) {
        if (row == null) {
            return null;
        }
        LocalDateTime activityTime = activityTimes.get(row.getActivityId());
        return activityTime != null ? activityTime : row.getCreatedAt();
    }

    private static boolean isNewerTerritoryRow(TerritoryPolygon candidate,
                                               LocalDateTime candidateTime,
                                               TerritoryPolygon current,
                                               LocalDateTime currentTime) {
        if (candidate == null) {
            return false;
        }
        if (current == null) {
            return true;
        }
        int timeCompare = compareNullableTime(candidateTime, currentTime);
        if (timeCompare != 0) {
            return timeCompare > 0;
        }
        return compareNullableLong(candidate.getActivityId(), current.getActivityId()) > 0;
    }

    private static int compareNullableTime(LocalDateTime left, LocalDateTime right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return left.compareTo(right);
    }

    private static int compareNullableLong(Long left, Long right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return left.compareTo(right);
    }

    private List<RouteTraceDto> routeTracesFor(OwnedLandMask mask) {
        if (mask == null || !mask.active() || mask.routeActivityIds().isEmpty()) {
            return List.of();
        }

        List<Long> routeActivityIds = representativeRouteActivityIds(mask.routeActivityIds(), MAX_TERRITORY_ROUTE_TRACES);
        if (routeActivityIds.isEmpty()) {
            return List.of();
        }

        Map<Long, LocalDateTime> activityTimes = effectiveActivityTimesForIds(routeActivityIds);
        List<Object[]> rows = activityPointRepository.findRoutePreviewSamplesByActivityIds(
                routeActivityIds,
                MAX_TERRITORY_ROUTE_TRACE_POINTS
        );
        Map<Long, List<RoutePointDto>> pointsByActivityId = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 3 || row[1] == null || row[2] == null) {
                continue;
            }
            Long activityId = ((Number) row[0]).longValue();
            double latitude = ((Number) row[1]).doubleValue();
            double longitude = ((Number) row[2]).doubleValue();
            if (Double.isFinite(latitude) && Double.isFinite(longitude)) {
                pointsByActivityId
                        .computeIfAbsent(activityId, ignored -> new ArrayList<>())
                        .add(new RoutePointDto(round6(latitude), round6(longitude)));
            }
        }

        List<RouteTraceDto> traces = new ArrayList<>();
        for (Map.Entry<Long, List<RoutePointDto>> entry : pointsByActivityId.entrySet()) {
            List<RoutePointDto> points = entry.getValue();
            if (points.size() < MIN_TERRITORY_ROUTE_POINTS) {
                continue;
            }
            LocalDateTime activityTime = activityTimes.get(entry.getKey());
            traces.add(new RouteTraceDto(
                    entry.getKey(),
                    points,
                    TERRITORY_ROUTE_TRACE_RADIUS_METERS,
                    activityTime != null ? activityTime.toString() : mask.createdAt()
            ));
        }
        return traces;
    }

    private static List<Long> representativeRouteActivityIds(List<Long> activityIds, int maxCount) {
        if (activityIds == null || activityIds.isEmpty() || maxCount <= 0) {
            return List.of();
        }

        List<Long> distinctIds = activityIds.stream()
                .filter(Objects::nonNull)
                .collect(
                        LinkedHashSet<Long>::new,
                        LinkedHashSet::add,
                        LinkedHashSet::addAll
                )
                .stream()
                .toList();
        if (distinctIds.size() <= maxCount) {
            return distinctIds;
        }

        LinkedHashSet<Long> selectedIds = new LinkedHashSet<>();
        double step = (distinctIds.size() - 1.0) / (maxCount - 1.0);
        for (int index = 0; index < maxCount; index += 1) {
            int selectedIndex = (int) Math.round(index * step);
            selectedIds.add(distinctIds.get(Math.min(distinctIds.size() - 1, selectedIndex)));
        }

        int fillIndex = 0;
        while (selectedIds.size() < maxCount && fillIndex < distinctIds.size()) {
            selectedIds.add(distinctIds.get(fillIndex));
            fillIndex += 1;
        }

        return List.copyOf(selectedIds);
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
        List<Long> routeActivityIds = new ArrayList<>();
        int sourceRowCount = 0;
        double sourceCellMeters = Double.POSITIVE_INFINITY;
        for (TerritoryPolygon row : rows) {
            TerritoryPolygonComputer.DecodedTerritoryMask mask = TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates());
            if (!mask.isLandTerritory() || mask.cells().isEmpty()) {
                continue;
            }
            sourceRowCount += 1;
            sourceId = row.getId();
            sourceActivityId = row.getActivityId();
            if (row.getActivityId() != null) {
                routeActivityIds.add(row.getActivityId());
            }
            sourceCellMeters = Math.min(sourceCellMeters, mask.cellMeters());
            if (newestCreatedAt == null && row.getCreatedAt() != null) {
                newestCreatedAt = row.getCreatedAt().toString();
            }
            sourceCells.addAll(mask.cells());
        }
        List<Long> distinctRouteActivityIds = routeActivityIds.stream().distinct().toList();

        if (sourceCells.isEmpty()) {
            return new UnionedLandMask(null, null, distinctRouteActivityIds, List.of(),
                    TerritoryPolygonComputer.LAND_MASK_CELL_METERS, 0.0, newestCreatedAt);
        }
        if (!Double.isFinite(sourceCellMeters) || sourceCellMeters <= 0.0) {
            sourceCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        }

        double responseCellMeters = responseCellMetersFor(sourceCells.size(), sourceCellMeters);
        double refLat = sourceCells.get(0).latitude();
        double cosRef = Math.cos(Math.toRadians(refLat));
        if (Math.abs(cosRef) < 1e-6) {
            return new UnionedLandMask(null, null, distinctRouteActivityIds, List.of(), responseCellMeters, 0.0, newestCreatedAt);
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
        List<MaskCellDto> cellDtos = union.values().stream()
                .map(MaskAccumulator::toDto)
                .toList();
        double totalArea = cellDtos.size() * responseCellMeters * responseCellMeters;
        return new UnionedLandMask(
                sourceRowCount == 1 ? sourceId : null,
                sourceRowCount == 1 ? sourceActivityId : null,
                distinctRouteActivityIds,
                cellDtos,
                responseCellMeters,
                totalArea,
                newestCreatedAt
        );
    }

    private static double responseCellMetersFor(int sourceCellCount, double sourceCellMeters) {
        double meters = Math.max(TerritoryPolygonComputer.LAND_MASK_CELL_METERS, sourceCellMeters);
        if (sourceCellMeters >= COARSE_LAND_MASK_CELL_METERS
                && sourceCellCount <= MAX_COARSE_LAND_MASK_RESPONSE_CELLS) {
            return meters;
        }
        if (sourceCellCount > LARGE_LAND_MASK_SOURCE_CELL_COUNT) {
            meters = Math.max(meters, LARGE_LAND_MASK_RESPONSE_CELL_METERS);
        }
        if (sourceCellCount <= MAX_RESPONSE_MASK_CELLS) {
            return Math.min(meters, MAX_REAL_USER_LAND_MASK_RESPONSE_CELL_METERS);
        }
        double scale = Math.sqrt(sourceCellCount / (double) MAX_RESPONSE_MASK_CELLS);
        return Math.min(
                Math.ceil(meters * scale),
                MAX_REAL_USER_LAND_MASK_RESPONSE_CELL_METERS
        );
    }

    private static MaskGridPoint responseCellPoint(double latitude, double longitude, double cellMeters, double cosRef) {
        long y = Math.round(latitude * TerritoryPolygonComputer.METERS_PER_DEG_LAT / cellMeters);
        long x = Math.round(longitude * TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosRef / cellMeters);
        return new MaskGridPoint(x, y);
    }

    private static void recordSourceCellFootprintClaims(
            Map<String, Map<OwnerActivityKey, MaskCellClaim>> claimsByCell,
            TerritoryPolygon row,
            TerritoryPolygonComputer.MaskCell cell,
            double sourceCellMeters,
            double responseCellMeters,
            double cosRef,
            OwnerActivityKey sourceKey,
            LocalDateTime activityTime
    ) {
        if (row == null || row.getUserId() == null || cell == null
                || sourceKey == null || sourceKey.ownerId() == null
                || !Double.isFinite(cell.latitude()) || !Double.isFinite(cell.longitude())) {
            return;
        }
        MaskGridPoint center = responseCellPoint(cell.latitude(), cell.longitude(), responseCellMeters, cosRef);
        double sourceMeters = Double.isFinite(sourceCellMeters) && sourceCellMeters > 0
                ? sourceCellMeters
                : responseCellMeters;
        double overlapRadius = sourceMeters <= responseCellMeters * 1.05
                ? 0.0
                : Math.max(0.5, (sourceMeters + responseCellMeters) / (2.0 * responseCellMeters));
        long gridRadius = Math.max(0, (long) Math.ceil(overlapRadius));
        for (long dy = -gridRadius; dy <= gridRadius; dy += 1) {
            for (long dx = -gridRadius; dx <= gridRadius; dx += 1) {
                if (Math.abs(dx) > overlapRadius || Math.abs(dy) > overlapRadius) {
                    continue;
                }
                long x = center.x() + dx;
                long y = center.y() + dy;
                MaskGridPoint point = new MaskGridPoint(x, y);
                double[] pointCenter = responseCellCenter(point, responseCellMeters, cosRef);
                claimsByCell.computeIfAbsent(point.key(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(sourceKey, ignored -> new MaskCellClaim(row.getUserId(), point.x(), point.y()))
                        .record(pointCenter[0], pointCenter[1], row, activityTime);
            }
        }
    }

    private static double[] responseCellCenter(MaskGridPoint point, double cellMeters, double cosRef) {
        double latitude = point.y() * cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double longitude = point.x() * cellMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosRef);
        return new double[]{latitude, longitude};
    }

    private static PolygonResponse stripCells(PolygonResponse response) {
        if (response == null || response.polygons().isEmpty()) {
            return response;
        }
        List<PolygonDto> stripped = response.polygons().stream()
                .map(poly -> new PolygonDto(
                        poly.id(), poly.activityId(), poly.ownerId(),
                        poly.ownerName(), poly.color(), poly.active(),
                        poly.areaSquareMeters(), List.of(), List.of(),
                        poly.shapeType(), poly.cellMeters(), poly.createdAt(),
                        List.of()))
                .toList();
        return new PolygonResponse(stripped, response.totalAreaSquareMeters(),
                response.polygonCount(), response.backfillInProgress(),
                response.pendingActivityCount());
    }

    private static PolygonDtoBounds polygonDtoBounds(PolygonDto polygon) {
        if (polygon == null || polygon.cells() == null || polygon.cells().isEmpty()) {
            return null;
        }
        double minLat = Double.POSITIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        double minLng = Double.POSITIVE_INFINITY;
        double maxLng = Double.NEGATIVE_INFINITY;
        for (MaskCellDto cell : polygon.cells()) {
            if (cell == null || !Double.isFinite(cell.latitude()) || !Double.isFinite(cell.longitude())) {
                continue;
            }
            minLat = Math.min(minLat, cell.latitude());
            maxLat = Math.max(maxLat, cell.latitude());
            minLng = Math.min(minLng, cell.longitude());
            maxLng = Math.max(maxLng, cell.longitude());
        }
        if (!Double.isFinite(minLat) || !Double.isFinite(maxLat)
                || !Double.isFinite(minLng) || !Double.isFinite(maxLng)) {
            return null;
        }
        return new PolygonDtoBounds(minLat, maxLat, minLng, maxLng);
    }

    private static PolygonDtoBounds mergePolygonDtoBounds(PolygonDtoBounds current, PolygonDtoBounds next) {
        if (current == null) {
            return next;
        }
        if (next == null) {
            return current;
        }
        return new PolygonDtoBounds(
                Math.min(current.minLat(), next.minLat()),
                Math.max(current.maxLat(), next.maxLat()),
                Math.min(current.minLng(), next.minLng()),
                Math.max(current.maxLng(), next.maxLng())
        );
    }

    private static double polygonDtoBoundsDistanceMeters(PolygonDtoBounds a, PolygonDtoBounds b) {
        if (a == null || b == null) {
            return Double.POSITIVE_INFINITY;
        }
        double latGap = a.maxLat() < b.minLat()
                ? b.minLat() - a.maxLat()
                : (b.maxLat() < a.minLat() ? a.minLat() - b.maxLat() : 0.0);
        double lngGap = a.maxLng() < b.minLng()
                ? b.minLng() - a.maxLng()
                : (b.maxLng() < a.minLng() ? a.minLng() - b.maxLng() : 0.0);
        double centerLat = (a.centerLat() + b.centerLat()) / 2.0;
        double cosLat = Math.max(1e-6, Math.abs(Math.cos(Math.toRadians(centerLat))));
        return Math.hypot(
                latGap * TerritoryPolygonComputer.METERS_PER_DEG_LAT,
                lngGap * TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat
        );
    }

    private static double safeDouble(Double value) {
        return value != null && Double.isFinite(value) ? value : 0.0;
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
            if (mask.processed()) {
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

    private List<Long> findMissingGlobalPolygonActivityIds(Long activeUserId) {
        if (activeUserId == null) {
            return List.of();
        }
        List<Long> candidates = activityRepository.findMissingRealUserTerritoryActivityIdsExcludingRunner(
                ActivityType.RUN,
                activeUserId,
                PageRequest.of(0, GLOBAL_POLYGON_WARMUP_SCAN_LIMIT)
        );
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        List<Long> missingActivityIds = new ArrayList<>();
        for (Long activityId : candidates) {
            if (activityId == null || !isGpsQualifiedTerritoryActivity(activityId)) {
                continue;
            }
            missingActivityIds.add(activityId);
        }
        return missingActivityIds;
    }

    private static void appendMissingActivityIds(List<Long> target, List<Long> source) {
        if (target == null || source == null || source.isEmpty()) {
            return;
        }
        Set<Long> seen = new HashSet<>(target);
        for (Long activityId : source) {
            if (activityId != null && seen.add(activityId)) {
                target.add(activityId);
            }
        }
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
        long now = System.currentTimeMillis();
        String activityPart;
        if (cachedGlobalSignature != null && (now - lastGlobalSignatureTimestamp) < 30_000) {
            activityPart = cachedGlobalSignature;
        } else {
                Object[] row = activityRepository.findRealUserGlobalActivitySetSignatureByActivityType(ActivityType.RUN);
            if (row == null || row.length == 0) {
                activityPart = "global:0:0:none";
            } else {
                Object[] values = row;
                if (row.length == 1 && row[0] instanceof Object[] nested) {
                    values = nested;
                }
                long count = numberAt(values, 0);
                long maxId = numberAt(values, 1);
                String newest = values.length > 2 && values[2] != null ? values[2].toString() : "none";
                activityPart = "global:" + count + ":" + maxId + ":" + newest;
            }
            cachedGlobalSignature = activityPart;
            lastGlobalSignatureTimestamp = now;
        }
        String polygonSignature = globalLiveLandMaskSignature();
        return activityPart + "|" + polygonSignature + "|active:" + polygonActivitySignature(activeUserId);
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
        long areaTotal = numberAt(values, 3);
        long coordinateLengthTotal = numberAt(values, 4);
        return "polygons:" + count + ":" + maxId + ":" + newest + ":" + areaTotal + ":" + coordinateLengthTotal;
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
                .anyMatch(TerritoryPolygonComputer.DecodedTerritoryMask::processed);
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

    private record PolygonDtoBounds(
            double minLat,
            double maxLat,
            double minLng,
            double maxLng
    ) {
        double centerLat() {
            return (minLat + maxLat) / 2.0;
        }

        double centerLng() {
            return (minLng + maxLng) / 2.0;
        }
    }

    private record PolygonDtoInfo(
            PolygonDto polygon,
            int index,
            PolygonDtoBounds bounds,
            double distanceMeters
    ) {
        PolygonDtoInfo withDistance(double nextDistanceMeters) {
            return new PolygonDtoInfo(polygon, index, bounds, nextDistanceMeters);
        }
    }

    private record MaskGridPoint(long x, long y) {
        String key() {
            return y + ":" + x;
        }

    }

    private record OwnerActivityKey(Long ownerId, Long activityId) {}

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

    private static final class MaskCellClaim {
        private final Long ownerId;
        private final MaskAccumulator accumulator;
        private LocalDateTime latestOwnershipTime;
        private Long latestActivityId;

        MaskCellClaim(Long ownerId, long gridX, long gridY) {
            this.ownerId = ownerId;
            this.accumulator = new MaskAccumulator(gridX, gridY);
        }

        void record(double latitude, double longitude, TerritoryPolygon row, LocalDateTime ownershipTime) {
            accumulator.record(latitude, longitude);
            if (isNewerRow(row, ownershipTime)) {
                latestOwnershipTime = ownershipTime;
                latestActivityId = row.getActivityId();
            }
        }

        private boolean isNewerRow(TerritoryPolygon row, LocalDateTime ownershipTime) {
            Long activityId = row.getActivityId();
            if (ownershipTime != null) {
                if (latestOwnershipTime == null || ownershipTime.isAfter(latestOwnershipTime)) {
                    return true;
                }
                if (ownershipTime.isBefore(latestOwnershipTime)) {
                    return false;
                }
            } else if (latestOwnershipTime != null) {
                return false;
            }
            return activityId != null && (latestActivityId == null || activityId > latestActivityId);
        }

        static int compareOwnership(MaskCellClaim left, MaskCellClaim right) {
            int byOwnershipTime = compareNullableTime(left.latestOwnershipTime, right.latestOwnershipTime);
            if (byOwnershipTime != 0) {
                return byOwnershipTime;
            }
            int byActivityId = compareNullableLong(left.latestActivityId, right.latestActivityId);
            if (byActivityId != 0) {
                return byActivityId;
            }
            return Integer.compare(left.accumulator.count, right.accumulator.count);
        }

        private static int compareNullableTime(LocalDateTime left, LocalDateTime right) {
            if (left == null && right == null) {
                return 0;
            }
            if (left == null) {
                return -1;
            }
            if (right == null) {
                return 1;
            }
            return left.compareTo(right);
        }

        private static int compareNullableLong(Long left, Long right) {
            if (left == null && right == null) {
                return 0;
            }
            if (left == null) {
                return -1;
            }
            if (right == null) {
                return 1;
            }
            return left.compareTo(right);
        }
    }

    private record UnionedLandMask(
            Long id,
            Long activityId,
            List<Long> routeActivityIds,
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
            List<Long> routeActivityIds,
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

    @Transactional(readOnly = true)
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
            TerritoryMapResponse response = isLocalSharedRunner(activeRunner.getId())
                    ? localSharedRunnerFallbackTerritoryMap(activeRunner)
                    : TerritoryMapResponse.empty();
            cacheTerritoryMapResponse(activeRunner.getId(), activitySignature, response);
            return response;
        }

        Map<Long, RunnerBoard> runners = new LinkedHashMap<>();
        Map<String, CellAccumulator> cells = new HashMap<>();
        double latSum = 0.0;
        double lngSum = 0.0;
        int validSamples = 0;
        double activeLatSum = 0.0;
        double activeLngSum = 0.0;
        int activeSamples = 0;

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
            if (sample.runnerId().equals(activeRunner.getId())) {
                activeLatSum += sample.latitude();
                activeLngSum += sample.longitude();
                activeSamples += 1;
            }
        }

        if (validSamples == 0 || cells.isEmpty()) {
            TerritoryMapResponse response = isLocalSharedRunner(activeRunner.getId())
                    ? localSharedRunnerFallbackTerritoryMap(activeRunner)
                    : TerritoryMapResponse.empty();
            cacheTerritoryMapResponse(activeRunner.getId(), activitySignature, response);
            return response;
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

        double centerLat = activeSamples > 0 ? activeLatSum / activeSamples : latSum / validSamples;
        double centerLng = activeSamples > 0 ? activeLngSum / activeSamples : lngSum / validSamples;
        TerritoryMapResponse response = new TerritoryMapResponse(
                true,
                "live",
                new MapCenter(round(centerLat, 6), round(centerLng, 6), 13),
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

    private TerritoryMapResponse localSharedRunnerFallbackTerritoryMap(Runner activeRunner) {
        Long runnerId = activeRunner.getId();
        List<TerritoryCell> cells = List.of(
                localSharedRunnerFallbackCell(runnerId, "shared-flushing-west", "Sector 417", 40.746050, -73.836150, 22, 0),
                localSharedRunnerFallbackCell(runnerId, "shared-flushing-north", "Sector 231", 40.752650, -73.823200, 26, 1),
                localSharedRunnerFallbackCell(runnerId, "shared-flushing-center", "Sector 512", 40.745900, -73.813450, 31, 2),
                localSharedRunnerFallbackCell(runnerId, "shared-kissena-park", "Sector 684", 40.739650, -73.807500, 24, 3),
                localSharedRunnerFallbackCell(runnerId, "shared-flushing-east", "Sector 746", 40.744800, -73.797900, 18, 4)
        );
        int cellCount = cells.size();
        TerritoryRunner runner = new TerritoryRunner(
                runnerId,
                "You",
                ACTIVE_COLOR,
                true,
                cellCount,
                round(cellCount * APPROX_CELL_AREA_KM2, 1),
                cells.stream().mapToInt(TerritoryCell::sampleCount).sum(),
                100
        );
        TerritorySummary summary = new TerritorySummary(
                round(cellCount * APPROX_CELL_AREA_KM2, 1),
                cellCount,
                100,
                1,
                1
        );
        List<TerritoryZone> zones = cells.stream()
                .map(cell -> TerritoryZone.from(cell, runnerId))
                .toList();
        List<RecentCapture> recentCaptures = cells.stream()
                .limit(3)
                .map(cell -> new RecentCapture(cell.name(), "RECENT", cell.sampleCount()))
                .toList();
        return new TerritoryMapResponse(
                true,
                "local-shared-runner-fallback",
                new MapCenter(40.746, -73.813, 13),
                summary,
                cells,
                List.of(runner),
                zones,
                recentCaptures,
                null
        );
    }

    private static TerritoryCell localSharedRunnerFallbackCell(
            Long runnerId,
            String id,
            String name,
            double centerLat,
            double centerLng,
            int sampleCount,
            int freshnessOffsetDays
    ) {
        double score = sampleCount + ACTIVITY_PASS_BONUS + FRESH_ROUTE_BONUS;
        return new TerritoryCell(
                id,
                name,
                runnerId,
                "You",
                ACTIVE_COLOR,
                round(centerLat, 6),
                round(centerLng, 6),
                polygonFor(centerLat, centerLng),
                sampleCount,
                false,
                null,
                timestampForResponse(LocalDateTime.now().minusDays(freshnessOffsetDays)),
                round(score, 1),
                0.0,
                round(score, 1),
                100,
                3
        );
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
