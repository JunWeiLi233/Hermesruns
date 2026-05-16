package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ShoeTrackerTests {

    @Test
    void recommendShoeForTrailSurfacePrefersTrailShoeWithLowerRecentUsage() {
        Runner runner = new Runner();
        runner.setId(1L);

        Shoe recentlyWornTrail = shoe(10L, runner, "HOKA", "Speedgoat 6");
        Shoe restedTrail = shoe(11L, runner, "Saucony", "Peregrine 14");
        Shoe restedRoad = shoe(12L, runner, "Nike", "Pegasus 41");

        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);

        when(shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner))
                .thenReturn(List.of(recentlyWornTrail, restedTrail, restedRoad));
        when(activityRepository.sumDistanceKmByRunner(runner))
                .thenReturn(List.of(
                        new Object[] { 10L, 20.0 },
                        new Object[] { 11L, 30.0 },
                        new Object[] { 12L, 5.0 }
                ));
        when(activityRepository.findLastUsedDateByRunner(runner))
                .thenReturn(List.of(
                        new Object[] { 10L, LocalDateTime.now().minusDays(1) },
                        new Object[] { 11L, LocalDateTime.now().minusDays(6) },
                        new Object[] { 12L, LocalDateTime.now().minusDays(10) }
                ));
        when(modelRepository.findAll())
                .thenReturn(List.of(
                        catalogModel("HOKA", "Speedgoat 6", "trail"),
                        catalogModel("Saucony", "Peregrine 14", "trail"),
                        catalogModel("Nike", "Pegasus 41", "daily")
                ));

        ShoeTracker tracker = new ShoeTracker(shoeRepository, modelRepository, activityRepository);

        assertThat(tracker.recommendShoe(runner, CoachWorkoutType.EASY, "trail"))
                .containsSame(restedTrail);
        assertThat(restedTrail.getSurfaceType()).isEqualTo("trail");
        assertThat(restedTrail.getDaysSinceLastWear()).isGreaterThanOrEqualTo(5);
    }

    @Test
    void recommendShoeForTrailSurfaceFallsBackToTrailModelNamesWhenCatalogIsEmpty() {
        Runner runner = new Runner();
        runner.setId(1L);

        Shoe trailShoe = shoe(20L, runner, "HOKA", "Speedgoat 6");
        Shoe roadShoe = shoe(21L, runner, "Nike", "Pegasus 41");

        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        ShoeCatalogModelRepository modelRepository = mock(ShoeCatalogModelRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);

        when(shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner))
                .thenReturn(List.of(roadShoe, trailShoe));
        when(activityRepository.sumDistanceKmByRunner(runner))
                .thenReturn(List.of(
                        new Object[] { 20L, 40.0 },
                        new Object[] { 21L, 5.0 }
                ));
        when(activityRepository.findLastUsedDateByRunner(runner))
                .thenReturn(List.of());
        when(modelRepository.findAll()).thenReturn(List.of());

        ShoeTracker tracker = new ShoeTracker(shoeRepository, modelRepository, activityRepository);

        assertThat(tracker.recommendShoe(runner, CoachWorkoutType.EASY, "trail"))
                .containsSame(trailShoe);
        assertThat(trailShoe.getSurfaceType()).isEqualTo("trail");
        assertThat(roadShoe.getSurfaceType()).isEqualTo("road");
    }

    private Shoe shoe(Long id, Runner runner, String brand, String model) {
        Shoe shoe = new Shoe();
        shoe.setId(id);
        shoe.setRunner(runner);
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setInitialDistanceKm(0.0);
        shoe.setMaxDistanceKm(650.0);
        return shoe;
    }

    private ShoeCatalogModel catalogModel(String brandName, String modelName, String type) {
        ShoeCatalogBrand brand = new ShoeCatalogBrand();
        brand.setName(brandName);
        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brand);
        model.setName(modelName);
        model.setType(type);
        return model;
    }
}
