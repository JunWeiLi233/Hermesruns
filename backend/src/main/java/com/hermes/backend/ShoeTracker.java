package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ShoeTracker {
    private static final Duration CATALOG_TYPE_CACHE_TTL = Duration.ofMinutes(30);

    private final ShoeRepository shoeRepository;
    private final ShoeCatalogModelRepository modelRepository;
    private final ActivityRepository activityRepository;
    private final TtlCacheStore cacheStore;

    @Autowired
    public ShoeTracker(ShoeRepository shoeRepository, 
                       ShoeCatalogModelRepository modelRepository, 
                       ActivityRepository activityRepository,
                       TtlCacheStore cacheStore) {
        this.shoeRepository = shoeRepository;
        this.modelRepository = modelRepository;
        this.activityRepository = activityRepository;
        this.cacheStore = cacheStore;
    }

    public ShoeTracker(ShoeRepository shoeRepository,
                       ShoeCatalogModelRepository modelRepository,
                       ActivityRepository activityRepository) {
        this(shoeRepository, modelRepository, activityRepository,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    /**
     * Recommends a shoe for a given runner and workout type.
     * Considers shoe health (mileage), shoe type (speed vs daily), and rotation.
     */
    public Optional<Shoe> recommendShoe(Runner runner, CoachWorkoutType workoutType) {
        return recommendShoe(runner, workoutType, null);
    }

    /**
     * Recommends a shoe for a given runner, workout type, and preferred surface.
     * A Trail surface intentionally favors a rested trail shoe over the primary shoe.
     */
    public Optional<Shoe> recommendShoe(Runner runner, CoachWorkoutType workoutType, String preferredSurface) {
        List<Shoe> activeShoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        if (activeShoes.isEmpty()) return Optional.empty();

        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        Map<Long, Object> lastUsedMap = buildLastUsedMap(runner);
        List<ShoeModelType> catalog = loadCatalogTypes();
        activeShoes.forEach(s -> attachRotationContext(s, distanceMap, lastUsedMap, catalog));

        // Filter out shoes that are past their max distance
        List<Shoe> healthyShoes = activeShoes.stream()
                .filter(s -> s.getCurrentDistanceKm() < (s.getMaxDistanceKm() != null ? s.getMaxDistanceKm() : 800.0))
                .collect(Collectors.toList());

        if (healthyShoes.isEmpty()) {
            // If all are worn out, just pick the primary or the newest one
            return activeShoes.stream()
                    .filter(Shoe::getIsPrimary)
                    .findFirst()
                    .or(() -> Optional.of(activeShoes.get(0)));
        }

        // Map workout type to preferred shoe type
        String preferredType = mapWorkoutToShoeType(workoutType);
        String surface = normalizeSurface(preferredSurface);

        if (surface != null) {
            List<Shoe> surfaceMatches = healthyShoes.stream()
                    .filter(s -> surface.equals(resolveSurface(s)))
                    .toList();
            if (!surfaceMatches.isEmpty()) {
                List<Shoe> typeAndSurfaceMatches = surfaceMatches.stream()
                        .filter(s -> preferredType.equals(s.getType()) || "trail".equals(surface))
                        .toList();
                List<Shoe> ranked = typeAndSurfaceMatches.isEmpty() ? surfaceMatches : typeAndSurfaceMatches;
                return ranked.stream().min(surfaceAwareComparator());
            }
        }

        // Find shoes that match the preferred type
        List<Shoe> matchingShoes = new ArrayList<>();
        for (Shoe s : healthyShoes) {
            if (preferredType.equals(s.getType())) {
                matchingShoes.add(s);
            }
        }

        if (!matchingShoes.isEmpty()) {
            // Pick primary if it matches, otherwise the one with lowest mileage to rotate
            return matchingShoes.stream()
                    .filter(Shoe::getIsPrimary)
                    .findFirst()
                    .or(() -> matchingShoes.stream().min(Comparator.comparing(Shoe::getCurrentDistanceKm)));
        }

        // Fallback: pick primary or lowest mileage healthy shoe
        return healthyShoes.stream()
                .filter(Shoe::getIsPrimary)
                .findFirst()
                .or(() -> healthyShoes.stream().min(Comparator.comparing(Shoe::getCurrentDistanceKm)));
    }

    private String mapWorkoutToShoeType(CoachWorkoutType workoutType) {
        if (workoutType == null) return "daily";
        return switch (workoutType) {
            case INTERVALS, THRESHOLD, TEMPO -> "speed";
            case LONG_RUN -> "daily";
            case RECOVERY -> "daily";
            default -> "daily";
        };
    }

    private String resolveType(Shoe s, List<ShoeModelType> catalog) {
        // Try to match by brand and model name
        return catalog.stream()
                .filter(m -> m.brand().equalsIgnoreCase(s.getBrand()) &&
                             m.model().equalsIgnoreCase(s.getModel()))
                .findFirst()
                .map(ShoeModelType::type)
                .orElseGet(() -> inferShoeType(s));
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

    private String resolveSurface(Shoe shoe) {
        return "trail".equals(shoe.getSurfaceType()) ? "trail" : "road";
    }

    private String normalizeSurface(String surface) {
        if (surface == null) return null;
        String normalized = surface.trim().toLowerCase(Locale.ROOT);
        if ("trail".equals(normalized)) return "trail";
        if ("road".equals(normalized)) return "road";
        return null;
    }

    private Comparator<Shoe> surfaceAwareComparator() {
        return Comparator
                .comparingInt((Shoe s) -> daysSinceLastWearForRanking(s)).reversed()
                .thenComparing(Shoe::getCurrentDistanceKm, Comparator.nullsLast(Double::compareTo))
                .thenComparing(Shoe::getId, Comparator.nullsLast(Long::compareTo));
    }

    private int daysSinceLastWearForRanking(Shoe shoe) {
        Integer days = shoe.getDaysSinceLastWear();
        return days == null ? Integer.MAX_VALUE : Math.max(0, days);
    }

    private List<ShoeModelType> loadCatalogTypes() {
        Optional<List<ShoeModelType>> cached = cacheStore.get(
                "shoe-catalog-types",
                "all",
                new TypeReference<>() {}
        );
        if (cached.isPresent()) {
            return cached.get();
        }
        List<ShoeModelType> catalog = modelRepository.findAll().stream()
                .filter(model -> model.getBrand() != null)
                .map(model -> new ShoeModelType(
                        model.getBrand().getName(),
                        model.getName(),
                        model.getType()
                ))
                .toList();
        cacheStore.put("shoe-catalog-types", "all", catalog, CATALOG_TYPE_CACHE_TTL);
        return catalog;
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> map = new HashMap<>();
        for (Object[] row : activityRepository.sumDistanceKmByRunner(runner)) {
            map.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        return map;
    }

    private Map<Long, Object> buildLastUsedMap(Runner runner) {
        Map<Long, Object> map = new HashMap<>();
        for (Object[] row : activityRepository.findLastUsedDateByRunner(runner)) {
            if (row == null || row.length < 2 || !(row[0] instanceof Long shoeId)) continue;
            map.put(shoeId, row[1]);
        }
        return map;
    }

    private void attachCurrentDistance(Shoe s, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(s.getId(), 0.0);
        double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
        s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }

    private void attachRotationContext(Shoe shoe, Map<Long, Double> distanceMap, Map<Long, Object> lastUsedMap, List<ShoeModelType> catalog) {
        attachCurrentDistance(shoe, distanceMap);

        String type = resolveType(shoe, catalog);
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

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        if (value instanceof java.sql.Date date) return date.toLocalDate().atStartOfDay();
        if (value instanceof Date date) return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
        return null;
    }

    private record ShoeModelType(String brand, String model, String type) {}
}
