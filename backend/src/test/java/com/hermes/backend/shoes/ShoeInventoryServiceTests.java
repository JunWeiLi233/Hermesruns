package com.hermes.backend.shoes;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.coaching.CoachScheduledWorkout;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.coaching.CoachWorkoutType;
import com.hermes.backend.runner.Runner;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ShoeInventoryServiceTests {
    private final ShoeRepository shoes = mock(ShoeRepository.class);
    private final ActivityRepository activities = mock(ActivityRepository.class);
    private final ShoeCatalogModelRepository catalog = mock(ShoeCatalogModelRepository.class);
    private final CoachScheduledWorkoutRepository schedule = mock(CoachScheduledWorkoutRepository.class);
    private final ShoeIdentityService identity = new ShoeIdentityService();
    private final ShoeImageAssetRepository images = mock(ShoeImageAssetRepository.class);
    private final ShoeAdminAggregateService assets = new ShoeAdminAggregateService(identity,
            new ShoeImageAssetService(images, shoes));
    private final ShoeTrackerService tracker = new ShoeTrackerService(shoes, catalog, activities);
    private final ShoeInventoryService inventory = new ShoeInventoryService(shoes, activities, identity,
            catalog, tracker, schedule, assets);
    private final Runner runner = new Runner("inventory@hermes.test", "active");

    private Shoe shoe(long id, String model) {
        Shoe shoe = new Shoe();
        shoe.setId(id);
        shoe.setRunner(runner);
        shoe.setBrand("Nike");
        shoe.setModel(model);
        return shoe;
    }

    private void owned(Shoe shoe) {
        when(shoes.findByIdAndRunner(shoe.getId(), runner)).thenReturn(java.util.Optional.of(shoe));
        when(shoes.save(any(Shoe.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void listBackfillsOnlyMissingIdentityAndPreservesNullAggregateFallbacks() {
        Shoe missing = shoe(1, "Speedgoat");
        Shoe existing = shoe(2, "Road");
        existing.setIdentityKey("existing-key");
        existing.setInitialDistanceKm(12.345);
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(missing, existing));
        when(activities.sumDistanceKmByRunner(runner)).thenReturn(null);
        when(activities.findLastUsedDateByRunner(runner)).thenReturn(null);
        when(catalog.findAll()).thenReturn(null);

        assertThat(inventory.listShoes(runner, false)).containsExactly(missing, existing);
        assertThat(missing.getIdentityKey()).isEqualTo(identity.computeIdentityKey("Nike", "Speedgoat"));
        assertThat(missing.getCurrentDistanceKm()).isZero();
        assertThat(missing.getType()).isEqualTo("trail");
        assertThat(missing.getSurfaceType()).isEqualTo("trail");
        assertThat(missing.getLastWornAt()).isNull();
        assertThat(missing.getDaysSinceLastWear()).isNull();
        assertThat(existing.getCurrentDistanceKm()).isEqualTo(12.35);
        assertThat(existing.getIdentityKey()).isEqualTo("existing-key");
        verify(shoes).save(missing);
        verify(shoes, never()).save(existing);
    }

    @Test
    void inventoryMatchesCatalogAliasesAndNormalizesTypesWithoutChangingRecommendationRules() {
        Shoe alias = shoe(1, "Pegasus-41");
        Shoe future = shoe(2, "Future");
        Shoe unknown = shoe(3, "Unknown");
        ShoeCatalogBrand brand = new ShoeCatalogBrand();
        brand.setName("Nike");
        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brand);
        model.setName("Other name");
        model.setNameEn("Pegasus 41");
        model.setNameZh("Future");
        model.setType(" SPEED ");
        ShoeCatalogModel invalid = new ShoeCatalogModel();
        invalid.setBrand(brand);
        invalid.setName("Unknown");
        invalid.setType("unsupported");
        LocalDateTime lastWear = LocalDate.now().minusDays(4).atTime(10, 0);
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(alias, future, unknown));
        when(catalog.findAll()).thenReturn(Arrays.asList(null, new ShoeCatalogModel(), model, invalid));
        when(activities.sumDistanceKmByRunner(runner)).thenReturn(List.<Object[]>of(new Object[]{1L, 4.126}));
        when(activities.findLastUsedDateByRunner(runner)).thenReturn(List.of(
                new Object[]{1L, Timestamp.valueOf(lastWear)},
                new Object[]{2L, java.sql.Date.valueOf(LocalDate.now().plusDays(2))}));

        inventory.listShoes(runner, false);

        assertThat(alias.getType()).isEqualTo("speed");
        assertThat(alias.getSurfaceType()).isEqualTo("road");
        assertThat(alias.getCurrentDistanceKm()).isEqualTo(4.13);
        assertThat(alias.getLastWornAt()).isEqualTo(lastWear);
        assertThat(alias.getDaysSinceLastWear()).isEqualTo(4);
        assertThat(future.getType()).isEqualTo("speed");
        assertThat(future.getDaysSinceLastWear()).isZero();
        assertThat(unknown.getType()).isEqualTo("daily");
    }

    @Test
    void recentShoesSortsByLastWearAndKeepsTiesAndUnlinkedShoesStable() {
        Shoe unlinked = shoe(1, "A");
        Shoe older = shoe(2, "B");
        Shoe newer = shoe(3, "C");
        Shoe tied = shoe(4, "D");
        LocalDateTime date = LocalDateTime.now();
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner))
                .thenReturn(new ArrayList<>(List.of(unlinked, older, newer, tied)));
        when(activities.findLastUsedDateByRunner(runner)).thenReturn(List.of(
                new Object[]{2L, date.minusDays(2)}, new Object[]{3L, date}, new Object[]{4L, date}));
        assertThat(inventory.recentShoes(runner)).containsExactly(newer, tied, older, unlinked);
    }

    @Test
    void matchingAndClustersReuseCanonicalIdentityAndRetainOrderAndMileage() {
        Shoe first = shoe(1, "Pegasus 41");
        Shoe second = shoe(2, "Pegasus-41");
        Shoe empty = shoe(3, "");
        empty.setBrand("");
        first.setInitialDistanceKm(10.0);
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(first, second, empty));
        when(shoes.findByRunnerAndRetiredFalseAndIdentityKeyNotNull(runner)).thenReturn(List.of(first, second, empty));
        when(activities.sumDistanceKmByRunner(runner)).thenReturn(List.<Object[]>of(new Object[]{1L, 2.345}));

        ShoeMatchContext context = inventory.prepareMatchBatch(runner);
        List<Map<String, Object>> matches = List.of(
                inventory.matchShoe(context, new ShoeMatchRequest("NIKE", "Pegasus_41"), 0),
                inventory.matchShoe(context, new ShoeMatchRequest("", ""), 1));
        assertThat(matches).hasSize(2);
        assertThat(matches.get(0)).containsEntry("index", 0).containsEntry("identityKey", "nikepegasus41")
                .containsEntry("matches", List.of(first, second));
        assertThat(matches.get(1)).containsEntry("index", 1).containsEntry("identityKey", "na")
                .containsEntry("matches", List.of(empty));
        assertThat(first.getCurrentDistanceKm()).isEqualTo(12.35);
        assertThat(inventory.duplicateClusters(runner)).containsExactly(
                Map.of("identityKey", "nikepegasus41", "shoes", List.of(first, second)));
    }

    @Test
    void mergeProcessesEarlierTargetsBeforeReturningLaterMissingTarget() {
        Shoe keep = shoe(1, "Keep");
        Shoe target = shoe(2, "Target");
        target.setPhotoUrl("https://cdn.example.com/target.png");
        owned(keep);
        owned(target);

        assertThat(inventory.mergeShoes(runner, 1, List.of(2L, 99L)))
                .isEqualTo(ShoeMergeResult.notFound("Merge shoe not found: 99"));
        assertThat(keep.getPhotoUrl()).isEqualTo(target.getPhotoUrl());
        verify(activities).reassignActivitiesToShoe(runner, keep, 2L);
        verify(shoes).delete(target);
        verify(shoes, never()).save(any());
    }

    @Test
    void mergeDeduplicatesTargetsSumsInitialMileageAndKeepsFirstPhotoAndKeeperState() {
        Shoe keep = shoe(1, "Keep");
        Shoe first = shoe(2, "First");
        Shoe second = shoe(3, "Second");
        keep.setPhotoUrl(" ");
        keep.setIsPrimary(true);
        keep.setRetired(true);
        keep.setRetiredDate(LocalDateTime.now().minusDays(5));
        LocalDateTime retiredDate = keep.getRetiredDate();
        first.setInitialDistanceKm(12.345);
        first.setPhotoUrl("https://cdn.example.com/first.png");
        second.setInitialDistanceKm(null);
        second.setPhotoUrl("https://cdn.example.com/second.png");
        owned(keep);
        owned(first);
        owned(second);

        assertThat(inventory.mergeShoes(runner, 1, List.of(1L, 2L, 2L, 3L))).isEqualTo(ShoeMergeResult.merged(keep.getId()));
        assertThat(keep.getInitialDistanceKm()).isEqualTo(12.35);
        assertThat(keep.getPhotoUrl()).isEqualTo(first.getPhotoUrl());
        assertThat(keep.getIsPrimary()).isTrue();
        assertThat(keep.isRetired()).isTrue();
        assertThat(keep.getRetiredDate()).isEqualTo(retiredDate);
        assertThat(keep.getIdentityKey()).isEqualTo("nikekeep");
        verify(activities).reassignActivitiesToShoe(runner, keep, 2L);
        verify(activities).reassignActivitiesToShoe(runner, keep, 3L);
        verify(shoes).delete(first);
        verify(shoes).delete(second);
    }

    @Test
    void retirementKeepsPrimaryAndExistingDateAndReactivationClearsOnlyRetirement() {
        Shoe shoe = shoe(1, "Road");
        shoe.setIsPrimary(true);
        shoe.setRetired(true);
        LocalDateTime date = LocalDateTime.now().minusDays(2);
        shoe.setRetiredDate(date);
        owned(shoe);
        when(activities.sumDistanceKmByShoeId(1L)).thenReturn(12.345);
        inventory.setRetired(runner, 1L, true);
        assertThat(shoe.getRetiredDate()).isEqualTo(date);
        assertThat(shoe.getIsPrimary()).isTrue();
        assertThat(shoe.getCurrentDistanceKm()).isEqualTo(12.35);
        inventory.setRetired(runner, 1L, false);
        assertThat(shoe.isRetired()).isFalse();
        assertThat(shoe.getRetiredDate()).isNull();
        assertThat(shoe.getIsPrimary()).isTrue();
    }

    @Test
    void recommendationUsesQueryThenScheduleThenRotationAndCanonicalTracker() {
        Shoe road = shoe(1, "Road");
        Shoe trail = shoe(2, "Speedgoat");
        road.setIsPrimary(true);
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(road, trail));
        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setWorkoutType(CoachWorkoutType.EASY);
        workout.setNotes("trail and road options");
        when(schedule.findByRunnerAndScheduledDate(runner, LocalDate.now())).thenReturn(java.util.Optional.of(workout));

        Map<String, Object> scheduled = inventory.recommendation(runner, "invalid");
        assertThat(scheduled).containsEntry("targetSurface", "trail").containsEntry("targetSurfaceSource", "schedule");
        assertThat(((Map<?, ?>) scheduled.get("recommendedShoe")).get("id")).isEqualTo(2L);
        Map<String, Object> query = inventory.recommendation(runner, " ROAD ");
        assertThat(query).containsEntry("targetSurface", "road").containsEntry("targetSurfaceSource", "query");
        assertThat(((Map<?, ?>) query.get("recommendedShoe")).get("id")).isEqualTo(1L);
        assertThat(((Map<?, ?>) query.get("recommendedShoe")).get("recommendationReason"))
                .isEqualTo("Best match for road surface and EASY workout");
        when(schedule.findByRunnerAndScheduledDate(runner, LocalDate.now())).thenReturn(java.util.Optional.empty());
        assertThat(inventory.recommendation(runner, null)).containsEntry("targetSurface", null)
                .containsEntry("targetSurfaceSource", "rotation").containsEntry("scheduledWorkoutType", null);
    }

    @Test
    void absentOptionalCollaboratorsKeepRecommendationAndInventoryFallbacks() {
        ShoeInventoryService fallback = new ShoeInventoryService(shoes, activities, identity, null, null, null, null);
        Shoe shoe = shoe(1, "Road");
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(shoe));
        assertThat(fallback.listShoes(runner, false)).containsExactly(shoe);
        assertThat(shoe.getType()).isEqualTo("daily");
        assertThat(fallback.recommendation(runner, null)).containsEntry("recommendedShoe", null)
                .containsEntry("targetSurface", null).containsEntry("targetSurfaceSource", "rotation");
    }

    @Test
    void creationUsesCanonicalLiveAssetAfterIdentityAndDoesNotRoundInitialMileage() {
        ShoeImageAsset asset = new ShoeImageAsset();
        asset.setIdentityKey("nikepegasus41");
        asset.setLiveImageUrl("https://cdn.example.com/live.png");
        when(images.findByIdentityKey("nikepegasus41")).thenReturn(java.util.Optional.of(asset));
        when(shoes.save(any(Shoe.class))).thenAnswer(call -> call.getArgument(0));
        ShoeChanges changes = new ShoeChanges("Nike", "Pegasus 41", "Daily", true, null,
                null, true, 12.345, "https://cdn.example.com/user.png", true);

        Shoe created = inventory.createShoe(runner, changes);

        assertThat(created.getRunner()).isSameAs(runner);
        assertThat(created.getIdentityKey()).isEqualTo("nikepegasus41");
        assertThat(created.getPhotoUrl()).isEqualTo("https://cdn.example.com/user.png");
        assertThat(created.isPhotoVerified()).isTrue();
        assertThat(created.getIsPrimary()).isTrue();
        assertThat(created.getMaxDistanceKm()).isNull();
        assertThat(created.getCurrentDistanceKm()).isEqualTo(12.345);

        Shoe withoutPhoto = inventory.createShoe(runner, new ShoeChanges("Nike", "Pegasus 41", null, true,
                null, null, false, null, null, false));
        assertThat(withoutPhoto.getPhotoUrl()).isEqualTo(asset.getLiveImageUrl());
        assertThat(withoutPhoto.isPhotoVerified()).isTrue();
        assertThat(withoutPhoto.getCurrentDistanceKm()).isZero();
    }
}
