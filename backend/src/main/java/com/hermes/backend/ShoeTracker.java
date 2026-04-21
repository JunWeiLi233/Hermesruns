package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ShoeTracker {

    private final ShoeRepository shoeRepository;
    private final ShoeCatalogModelRepository modelRepository;
    private final ActivityRepository activityRepository;

    public ShoeTracker(ShoeRepository shoeRepository, 
                       ShoeCatalogModelRepository modelRepository, 
                       ActivityRepository activityRepository) {
        this.shoeRepository = shoeRepository;
        this.modelRepository = modelRepository;
        this.activityRepository = activityRepository;
    }

    /**
     * Recommends a shoe for a given runner and workout type.
     * Considers shoe health (mileage), shoe type (speed vs daily), and rotation.
     */
    public Optional<Shoe> recommendShoe(Runner runner, CoachWorkoutType workoutType) {
        List<Shoe> activeShoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        if (activeShoes.isEmpty()) return Optional.empty();

        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        activeShoes.forEach(s -> attachCurrentDistance(s, distanceMap));

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

        // Find shoes that match the preferred type
        List<Shoe> matchingShoes = new ArrayList<>();
        // Load all models once to avoid repeated DB hits
        List<ShoeCatalogModel> catalog = modelRepository.findAll();
        
        for (Shoe s : healthyShoes) {
            String shoeType = resolveType(s, catalog);
            if (preferredType.equals(shoeType)) {
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

    private String resolveType(Shoe s, List<ShoeCatalogModel> catalog) {
        // Try to match by brand and model name
        return catalog.stream()
                .filter(m -> m.getBrand().getName().equalsIgnoreCase(s.getBrand()) &&
                             m.getName().equalsIgnoreCase(s.getModel()))
                .findFirst()
                .map(ShoeCatalogModel::getType)
                .orElse("daily");
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> map = new HashMap<>();
        for (Object[] row : activityRepository.sumDistanceKmByRunner(runner)) {
            map.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        return map;
    }

    private void attachCurrentDistance(Shoe s, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(s.getId(), 0.0);
        double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
        s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }
}
