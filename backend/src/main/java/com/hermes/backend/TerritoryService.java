package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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

    /** Cap on polygons returned by the GET /api/territory/polygons endpoint. */
    private static final int MAX_POLYGON_RESULTS = 200;

    private final ActivityPointRepository activityPointRepository;
    private final TerritoryPolygonRepository territoryPolygonRepository;
    private final TerritoryPolygonComputer polygonComputer;
    private final ActivityRepository activityRepository;

    public TerritoryService(ActivityPointRepository activityPointRepository,
                            TerritoryPolygonRepository territoryPolygonRepository,
                            TerritoryPolygonComputer polygonComputer,
                            ActivityRepository activityRepository) {
        this.activityPointRepository = activityPointRepository;
        this.territoryPolygonRepository = territoryPolygonRepository;
        this.polygonComputer = polygonComputer;
        this.activityRepository = activityRepository;
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

        List<TerritoryPolygonComputer.DetectedPolygon> loops = polygonComputer.detectLoops(points);
        for (TerritoryPolygonComputer.DetectedPolygon loop : loops) {
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(userId);
            polygon.setActivityId(activityId);
            polygon.setCoordinates(TerritoryPolygonComputer.encodeCoordinates(loop.points()));
            polygon.setAreaSquareMeters(loop.areaSquareMeters());
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
            if (territoryPolygonRepository.existsByActivityId(activity.getId())) {
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
     * Returns the polygon response for the authenticated user.
     * Ordered newest-first, capped at MAX_POLYGON_RESULTS.
     */
    public PolygonResponse buildPolygonResponse(Long userId) {
        if (userId == null) {
            return new PolygonResponse(List.of(), 0.0, 0);
        }

        List<TerritoryPolygon> rows = territoryPolygonRepository.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(0, MAX_POLYGON_RESULTS)
        );

        List<PolygonDto> dtos = new ArrayList<>(rows.size());
        double totalArea = 0.0;
        for (TerritoryPolygon row : rows) {
            List<double[]> coords = TerritoryPolygonComputer.decodeCoordinates(row.getCoordinates());
            List<List<Double>> coordPairs = coords.stream()
                    .map(pt -> List.of(pt[0], pt[1]))
                    .toList();
            dtos.add(new PolygonDto(
                    row.getId(),
                    row.getActivityId(),
                    row.getAreaSquareMeters(),
                    coordPairs,
                    row.getCreatedAt() != null ? row.getCreatedAt().toString() : null
            ));
            totalArea += row.getAreaSquareMeters() != null ? row.getAreaSquareMeters() : 0.0;
        }

        return new PolygonResponse(dtos, totalArea, dtos.size());
    }

    // -----------------------------------------------------------------------
    // Response records for the polygon endpoint
    // -----------------------------------------------------------------------

    public record PolygonDto(
            Long id,
            Long activityId,
            Double areaSquareMeters,
            List<List<Double>> coordinates,
            String createdAt
    ) {}

    public record PolygonResponse(
            List<PolygonDto> polygons,
            double totalAreaSquareMeters,
            int polygonCount
    ) {}

    public TerritoryMapResponse buildTerritoryMap(Runner activeRunner) {
        if (activeRunner == null || activeRunner.getId() == null) {
            return TerritoryMapResponse.empty();
        }

        List<Object[]> rows = activityPointRepository.findTerritorySamples(
                ActivityType.RUN,
                PageRequest.of(0, MAX_TERRITORY_SAMPLES)
        );
        if (rows == null || rows.isEmpty()) {
            return TerritoryMapResponse.empty();
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
            return TerritoryMapResponse.empty();
        }

        assignColors(runners, activeRunner.getId());

        List<TerritoryCell> territoryCells = cells.values().stream()
                .map(cell -> cell.toCell(runners))
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
                .findFirst()
                .map(cell -> new TerritoryTarget(
                        cell.name(),
                        runners.containsKey(cell.ownerId()) ? runners.get(cell.ownerId()).name : "Rival",
                        round(APPROX_CELL_AREA_KM2, 1),
                        Math.max(2, (int) Math.ceil(cell.sampleCount() * 0.25)),
                        cell.contested() ? "Contested" : "Reachable"
                ))
                .orElse(null);

        return new TerritoryMapResponse(
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

    private static String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "RECENT";
        }
        return dateTime.getMonth().name().substring(0, 3) + " " + dateTime.getDayOfMonth();
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
        final Map<Long, Integer> samplesByRunner = new HashMap<>();
        LocalDateTime lastSeenAt;
        int totalSamples;

        CellAccumulator(String key, double latitude, double longitude) {
            this.key = key;
            this.centerLat = Math.floor(latitude / CELL_DEGREES) * CELL_DEGREES + CELL_DEGREES / 2.0;
            this.centerLng = Math.floor(longitude / CELL_DEGREES) * CELL_DEGREES + CELL_DEGREES / 2.0;
        }

        void record(TerritorySample sample) {
            samplesByRunner.merge(sample.runnerId(), 1, Integer::sum);
            totalSamples += 1;
            if (sample.seenAt() != null && (lastSeenAt == null || sample.seenAt().isAfter(lastSeenAt))) {
                lastSeenAt = sample.seenAt();
            }
        }

        TerritoryCell toCell(Map<Long, RunnerBoard> runners) {
            Map.Entry<Long, Integer> owner = samplesByRunner.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            if (owner == null) {
                return null;
            }
            Map.Entry<Long, Integer> challenger = samplesByRunner.entrySet().stream()
                    .filter(entry -> !entry.getKey().equals(owner.getKey()))
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            RunnerBoard ownerBoard = runners.get(owner.getKey());
            if (ownerBoard == null) {
                return null;
            }
            boolean contested = challenger != null && challenger.getValue() >= Math.max(2, owner.getValue() * 0.45);
            return new TerritoryCell(
                    key,
                    "Sector " + Math.abs(key.hashCode() % 900 + 100),
                    owner.getKey(),
                    ownerBoard.name,
                    ownerBoard.color,
                    round(centerLat, 6),
                    round(centerLng, 6),
                    polygonFor(centerLat, centerLng),
                    totalSamples,
                    contested,
                    challenger == null || !runners.containsKey(challenger.getKey()) ? null : runners.get(challenger.getKey()).name,
                    lastSeenAt
            );
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
            LocalDateTime lastSeenAt
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
            int sampleCount
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
                    cell.sampleCount()
            );
        }
    }

    public record RecentCapture(String name, String dateLabel, int sampleCount) {}

    public record TerritoryTarget(String name, String ownerName, double areaKm2, int samplesToContest, String difficulty) {}
}
