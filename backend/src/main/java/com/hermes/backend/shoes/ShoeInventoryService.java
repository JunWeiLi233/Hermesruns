package com.hermes.backend.shoes;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.coaching.CoachScheduledWorkout;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.coaching.CoachWorkoutType;
import com.hermes.backend.runner.Runner;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Runner-owned inventory operations; recommendation ranking remains in ShoeTrackerService. */
@Service
public class ShoeInventoryService {
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ShoeIdentityService shoeIdentityService;
    private final ShoeCatalogModelRepository shoeCatalogModelRepository;
    private final ShoeTrackerService shoeTrackerService;
    private final CoachScheduledWorkoutRepository scheduledWorkoutRepository;
    private final ShoeAdminAggregateService shoeAssets;

    public ShoeInventoryService(ShoeRepository shoeRepository,
                                ActivityRepository activityRepository,
                                ShoeIdentityService shoeIdentityService,
                                ShoeCatalogModelRepository shoeCatalogModelRepository,
                                ShoeTrackerService shoeTrackerService,
                                CoachScheduledWorkoutRepository scheduledWorkoutRepository,
                                ShoeAdminAggregateService shoeAssets) {
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.shoeIdentityService = shoeIdentityService;
        this.shoeCatalogModelRepository = shoeCatalogModelRepository;
        this.shoeTrackerService = shoeTrackerService;
        this.scheduledWorkoutRepository = scheduledWorkoutRepository;
        this.shoeAssets = shoeAssets;
    }

    public Optional<Shoe> findShoe(Runner runner, Long id) {
        return shoeRepository.findByIdAndRunner(id, runner);
    }

    public List<Shoe> listShoes(Runner runner, boolean includeRetired) {
        List<Shoe> shoes = includeRetired
                ? shoeRepository.findByRunnerOrderByCreatedAtDesc(runner)
                : shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);

        backfillIdentityKeys(shoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        Map<Long, Object> lastUsedMap = buildLastUsedMap(runner);
        Map<String, String> typeMap = buildShoeTypeMap();
        shoes.forEach(s -> attachRotationContext(s, distanceMap, lastUsedMap, typeMap));

        return shoes;
    }

    public Map<String, Object> recommendation(Runner runner, String surfaceOverride) {
        LocalDate today = LocalDate.now();
        CoachScheduledWorkout scheduledWorkout = scheduledWorkoutRepository == null
                ? null
                : scheduledWorkoutRepository.findByRunnerAndScheduledDate(runner, today).orElse(null);
        SurfacePreference surfacePreference = resolveSurfacePreference(surfaceOverride, scheduledWorkout);
        CoachWorkoutType workoutType = scheduledWorkout == null ? null : scheduledWorkout.getWorkoutType();

        Optional<Shoe> recommended = shoeTrackerService == null
                ? Optional.empty()
                : shoeTrackerService.recommendShoe(runner, workoutType, surfacePreference.surface());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("scheduledDate", today);
        body.put("scheduledWorkoutType", workoutType == null ? null : workoutType.name());
        body.put("targetSurface", surfacePreference.surface());
        body.put("targetSurfaceSource", surfacePreference.source());
        body.put("recommendedShoe", recommended.map(shoe -> recommendationPayload(shoe, workoutType, surfacePreference.surface())).orElse(null));
        return body;
    }

    public List<Map<String, Object>> duplicateClusters(Runner runner) {
        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseAndIdentityKeyNotNull(runner);
        backfillIdentityKeys(shoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        shoes.forEach(s -> attachCurrentDistance(s, distanceMap));

        Map<String, List<Shoe>> byKey = new LinkedHashMap<>();
        for (Shoe s : shoes) {
            String key = s.getIdentityKey();
            if (key == null || key.isBlank() || "na".equals(key)) continue;
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }

        List<Map<String, Object>> clusters = byKey.entrySet().stream()
                .filter(e -> e.getValue().size() > 1)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("identityKey", e.getKey());
                    m.put("shoes", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());

        return clusters;
    }

    public ShoeMatchContext prepareMatchBatch(Runner runner) {
        List<Shoe> allShoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        backfillIdentityKeys(allShoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        Map<String, List<Shoe>> byIdentity = new HashMap<>();
        for (Shoe s : allShoes) {
            String key = s.getIdentityKey();
            if (key == null) continue;
            byIdentity.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }

        return new ShoeMatchContext(byIdentity, distanceMap);
    }

    public Map<String, Object> matchShoe(ShoeMatchContext context, ShoeMatchRequest item, int index) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("index", index);
        String idKey = shoeIdentityService.computeIdentityKey(item.brand(), item.model());
        row.put("identityKey", idKey);
        List<Shoe> matches = new ArrayList<>(context.byIdentity().getOrDefault(idKey, List.of()));
        matches.forEach(s -> attachCurrentDistance(s, context.distanceByShoe()));
        row.put("matches", matches);
        return row;
    }

    @Transactional
    public ShoeMergeResult mergeShoes(Runner runner, long keepId, List<Long> mergeIdsList) {
        Optional<Shoe> keepOpt = findShoe(runner, keepId);
        if (keepOpt.isEmpty()) return ShoeMergeResult.notFound("Keeper shoe not found");
        Shoe keep = keepOpt.get();
        Set<Long> mergeIds = new LinkedHashSet<>(mergeIdsList);
        mergeIds.remove(keepId);
        if (mergeIds.isEmpty()) return ShoeMergeResult.noTargets();

        double extraInitial = 0.0;
        // Legacy order is intentional: a later missing target returns normally after earlier writes.
        for (Long mid : mergeIds) {
            Optional<Shoe> targetOpt = findShoe(runner, mid);
            if (targetOpt.isEmpty()) return ShoeMergeResult.notFound("Merge shoe not found: " + mid);
            Shoe target = targetOpt.get();
            if (target.getInitialDistanceKm() != null) {
                extraInitial += target.getInitialDistanceKm();
            }
            if ((keep.getPhotoUrl() == null || keep.getPhotoUrl().isBlank())
                    && target.getPhotoUrl() != null && !target.getPhotoUrl().isBlank()) {
                keep.setPhotoUrl(target.getPhotoUrl());
            }
            activityRepository.reassignActivitiesToShoe(runner, keep, mid);
            shoeRepository.delete(target);
        }
        if (extraInitial > 0) {
            double base = keep.getInitialDistanceKm() != null ? keep.getInitialDistanceKm() : 0.0;
            keep.setInitialDistanceKm(Math.round((base + extraInitial) * 100.0) / 100.0);
        }
        shoeIdentityService.applyIdentityKey(keep);
        shoeRepository.save(keep);
        return ShoeMergeResult.merged(keep.getId());
    }

    @SuppressWarnings("unchecked")
    public List<Shoe> recentShoes(Runner runner) {
        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        backfillIdentityKeys(shoes);

        // Build map of shoeId to last used date
        Map<Long, Object> lastUsed = new HashMap<>();
        for (Object[] row : activityRepository.findLastUsedDateByRunner(runner)) {
            lastUsed.put((Long) row[0], row[1]);
        }

        Map<Long, Double> distanceMap2 = buildShoeDistanceMap(runner);
        Map<String, String> typeMap = buildShoeTypeMap();
        shoes.forEach(s -> attachRotationContext(s, distanceMap2, lastUsed, typeMap));

        // Sort: shoes with recent activity first, then by last used date desc, unlinked shoes last
        shoes.sort((a, b) -> {
            Object da = lastUsed.get(a.getId());
            Object db = lastUsed.get(b.getId());
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return ((Comparable<Object>) db).compareTo(da);
        });

        return shoes;
    }

    public Shoe createShoe(Runner runner, ShoeChanges changes) {
        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        applyChanges(shoe, changes);
        shoeIdentityService.applyIdentityKey(shoe);
        if (shoeAssets != null) shoeAssets.applyLiveAssetToShoe(shoe);
        Shoe saved = shoeRepository.save(shoe);
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(initial);
        return saved;
    }

    public Shoe updateShoe(Shoe shoe, ShoeChanges changes) {
        applyChanges(shoe, changes);
        shoeIdentityService.applyIdentityKey(shoe);
        return saveWithCurrentDistance(shoe);
    }

    public void deleteShoe(Runner runner, Long id, boolean permanent) {
        Shoe shoe = requireShoe(runner, id, "Shoe not found");
        if (permanent) {
            activityRepository.unlinkShoeFromActivities(id);
            shoeRepository.delete(shoe);
        } else {
            applyRetiredState(shoe, true);
            shoeRepository.save(shoe);
        }
    }

    public Shoe setRetired(Runner runner, Long id, boolean retired) {
        Shoe shoe = requireShoe(runner, id, "Shoe not found");
        applyRetiredState(shoe, retired);
        return saveWithCurrentDistance(shoe);
    }

    public List<Shoe> listRetiredShoes(Runner runner) {
        List<Shoe> retiredShoes = shoeRepository.findByRunnerAndRetiredTrueOrderByRetiredDateDesc(runner);

        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        Map<Long, Object> lastUsedMap = buildLastUsedMap(runner);
        Map<String, String> typeMap = buildShoeTypeMap();
        retiredShoes.forEach(s -> attachRotationContext(s, distanceMap, lastUsedMap, typeMap));

        return retiredShoes;
    }

    public Activity assignShoeToActivity(Runner runner, Long shoeId, Long activityId) {
        Activity activity = activityRepository.findByIdAndRunner(activityId, runner)
                .orElseThrow(() -> new ShoeNotFoundException("Activity not found"));
        if (shoeId == 0) {
            activity.setShoe(null);
        } else {
            activity.setShoe(requireShoe(runner, shoeId, "Shoe not found"));
        }
        return activityRepository.saveAndFlush(activity);
    }

    private Shoe requireShoe(Runner runner, Long id, String message) {
        return findShoe(runner, id).orElseThrow(() -> new ShoeNotFoundException(message));
    }

    private Shoe saveWithCurrentDistance(Shoe shoe) {
        Shoe saved = shoeRepository.save(shoe);
        double activityKm = activityRepository.sumDistanceKmByShoeId(saved.getId());
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
        return saved;
    }

    private void applyChanges(Shoe shoe, ShoeChanges changes) {
        if (changes.brand() != null) shoe.setBrand(changes.brand());
        if (changes.model() != null) shoe.setModel(changes.model());
        if (changes.nicknameChanged()) shoe.setNickname(changes.nickname());
        if (changes.maxDistanceKm() != null) shoe.setMaxDistanceKm(changes.maxDistanceKm());
        if (changes.retired() != null) applyRetiredState(shoe, changes.retired());
        if (changes.isPrimary() != null) shoe.setIsPrimary(changes.isPrimary());
        if (changes.initialDistanceKm() != null) shoe.setInitialDistanceKm(changes.initialDistanceKm());
        if (changes.photoUrlChanged()) shoe.setPhotoUrl(changes.photoUrl());
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> map = new HashMap<>();
        List<Object[]> rows = activityRepository.sumDistanceKmByRunner(runner);
        if (rows == null) return map;
        for (Object[] row : rows) {
            map.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        return map;
    }

    private Map<Long, Object> buildLastUsedMap(Runner runner) {
        Map<Long, Object> map = new HashMap<>();
        List<Object[]> rows = activityRepository.findLastUsedDateByRunner(runner);
        if (rows == null) return map;
        for (Object[] row : rows) {
            map.put((Long) row[0], row[1]);
        }
        return map;
    }

    private Map<String, String> buildShoeTypeMap() {
        if (shoeCatalogModelRepository == null) return Map.of();
        Map<String, String> map = new HashMap<>();
        List<ShoeCatalogModel> models = shoeCatalogModelRepository.findAll();
        if (models == null) return map;
        for (ShoeCatalogModel model : models) {
            if (model == null || model.getBrand() == null) continue;
            String type = normalizeShoeType(model.getType());
            putTypeKey(map, model.getBrand().getName(), model.getName(), type);
            putTypeKey(map, model.getBrand().getName(), model.getNameEn(), type);
            putTypeKey(map, model.getBrand().getName(), model.getNameZh(), type);
        }
        return map;
    }

    private void putTypeKey(Map<String, String> map, String brand, String model, String type) {
        String key = typeKey(brand, model);
        if (!key.isBlank()) map.put(key, type);
    }

    private void backfillIdentityKeys(List<Shoe> shoes) {
        for (Shoe s : shoes) {
            if (s.getIdentityKey() == null || s.getIdentityKey().isBlank()) {
                shoeIdentityService.applyIdentityKey(s);
                shoeRepository.save(s);
            }
        }
    }

    private void attachCurrentDistance(Shoe s, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(s.getId(), 0.0);
        double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
        s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }

    private void attachRotationContext(Shoe shoe, Map<Long, Double> distanceMap, Map<Long, Object> lastUsedMap, Map<String, String> typeMap) {
        attachCurrentDistance(shoe, distanceMap);

        String type = typeMap.get(typeKey(shoe.getBrand(), shoe.getModel()));
        if (type == null) type = inferShoeType(shoe);
        shoe.setType(type);
        shoe.setSurfaceType("trail".equals(type) ? "trail" : "road");

        LocalDateTime lastWornAt = toLocalDateTime(lastUsedMap.get(shoe.getId()));
        shoe.setLastWornAt(lastWornAt);
        if (lastWornAt == null) {
            shoe.setDaysSinceLastWear(null);
        } else {
            long days = ChronoUnit.DAYS.between(lastWornAt.toLocalDate(), LocalDate.now());
            shoe.setDaysSinceLastWear((int) Math.max(0, days));
        }
    }

    private Map<String, Object> recommendationPayload(Shoe shoe, CoachWorkoutType workoutType, String targetSurface) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", shoe.getId());
        payload.put("brand", shoe.getBrand());
        payload.put("model", shoe.getModel());
        payload.put("nickname", shoe.getNickname());
        payload.put("photoUrl", shoe.getPhotoUrl());
        payload.put("type", shoe.getType());
        payload.put("surfaceType", shoe.getSurfaceType());
        payload.put("currentDistanceKm", shoe.getCurrentDistanceKm());
        payload.put("maxDistanceKm", shoe.getMaxDistanceKm());
        payload.put("lastWornAt", shoe.getLastWornAt());
        payload.put("daysSinceLastWear", shoe.getDaysSinceLastWear());
        String workoutLabel = workoutType == null ? "today's run" : workoutType.name() + " workout";
        String surfaceLabel = targetSurface == null ? "rotation" : targetSurface + " surface";
        payload.put("recommendationReason", "Best match for " + surfaceLabel + " and " + workoutLabel);
        return payload;
    }

    private SurfacePreference resolveSurfacePreference(String surfaceOverride, CoachScheduledWorkout scheduledWorkout) {
        String normalizedOverride = normalizeSurface(surfaceOverride);
        if (normalizedOverride != null) {
            return new SurfacePreference(normalizedOverride, "query");
        }
        String scheduledSurface = inferScheduledSurface(scheduledWorkout);
        if (scheduledSurface != null) {
            return new SurfacePreference(scheduledSurface, "schedule");
        }
        return new SurfacePreference(null, "rotation");
    }

    private String inferScheduledSurface(CoachScheduledWorkout scheduledWorkout) {
        if (scheduledWorkout == null || scheduledWorkout.getNotes() == null) return null;
        String notes = scheduledWorkout.getNotes().toLowerCase(Locale.ROOT);
        if (notes.contains("trail")) return "trail";
        if (notes.contains("road")) return "road";
        return null;
    }

    private String normalizeSurface(String surface) {
        if (surface == null) return null;
        String normalized = surface.trim().toLowerCase(Locale.ROOT);
        if ("trail".equals(normalized)) return "trail";
        if ("road".equals(normalized)) return "road";
        return null;
    }

    private String typeKey(String brand, String model) {
        return ((brand == null ? "" : brand) + "::" + (model == null ? "" : model))
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\s\\-_'’.,/]+", "");
    }

    private String normalizeShoeType(String type) {
        String normalized = type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
        if (Set.of("daily", "speed", "race", "trail", "stability").contains(normalized)) return normalized;
        return "daily";
    }

    private String inferShoeType(Shoe shoe) {
        String combined = String.join(" ",
                shoe.getBrand() == null ? "" : shoe.getBrand(),
                shoe.getModel() == null ? "" : shoe.getModel(),
                shoe.getNickname() == null ? "" : shoe.getNickname()
        ).toLowerCase(Locale.ROOT);
        if (combined.contains("trail")
                || combined.contains("speedgoat")
                || combined.contains("mafate")
                || combined.contains("peregrine")
                || combined.contains("torrent")
                || combined.contains("kiger")
                || combined.contains("terrex")) {
            return "trail";
        }
        return "daily";
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof Timestamp timestamp) return timestamp.toLocalDateTime();
        if (value instanceof java.sql.Date date) return date.toLocalDate().atStartOfDay();
        if (value instanceof Date date) return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
        return null;
    }

    private void applyRetiredState(Shoe shoe, boolean retired) {
        shoe.setRetired(retired);
        if (retired) {
            if (shoe.getRetiredDate() == null) {
                shoe.setRetiredDate(LocalDateTime.now());
            }
        } else {
            shoe.setRetiredDate(null);
        }
    }

    private record SurfacePreference(String surface, String source) {}
}
