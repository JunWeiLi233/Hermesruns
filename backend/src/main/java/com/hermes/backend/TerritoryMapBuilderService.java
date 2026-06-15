package com.hermes.backend;

import org.springframework.data.domain.PageRequest;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class TerritoryMapBuilderService {
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
    private static final String TERRITORY_MAP_CACHE_NAMESPACE = "territory-map";
    private static final String TERRITORY_MAP_CACHE_VERSION = "territory-map-v25-activity-split-render";
    private static final Duration TERRITORY_MAP_CACHE_TTL = Duration.ofMinutes(15);

    private final ActivityPointRepository activityPointRepository;
    private final ActivityRepository activityRepository;
    private final RunnerRepository runnerRepository;
    private final TtlCacheStore cacheStore;

    TerritoryMapBuilderService(
            ActivityPointRepository activityPointRepository,
            ActivityRepository activityRepository,
            RunnerRepository runnerRepository,
            TtlCacheStore cacheStore
    ) {
        this.activityPointRepository = activityPointRepository;
        this.activityRepository = activityRepository;
        this.runnerRepository = runnerRepository;
        this.cacheStore = cacheStore;
    }

    String signature(Long runnerId) {
        if (runnerId == null) {
            return TERRITORY_MAP_CACHE_VERSION + "|global:0:0:none|active:0:0:none";
        }
        return TERRITORY_MAP_CACHE_VERSION + "|" + territoryMapActivitySignature(runnerId);
    }

    private record CachedTerritoryMapResponse(
            String version,
            String activitySignature,
            TerritoryMapResponse response
    ) {}

    TerritoryMapResponse build(Runner activeRunner) {
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

    void evictCache(Long userId) {
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

    private boolean isLocalSharedRunner(Long userId) {
        if (userId == null) {
            return false;
        }
        return runnerRepository.findById(userId)
                .map(Runner::getEmail)
                .filter(email -> LocalSharedRunnerBootstrapService.DEFAULT_EMAIL.equalsIgnoreCase(email))
                .isPresent();
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
    private static long numberAt(Object[] values, int index) {
        if (values == null || index >= values.length || values[index] == null) {
            return 0L;
        }
        Object raw = values[index];
        if (raw instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(raw.toString());
        } catch (RuntimeException ignored) {
            return 0L;
        }
    }
}
