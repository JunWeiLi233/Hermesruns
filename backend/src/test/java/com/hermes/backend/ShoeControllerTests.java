package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShoeControllerTests {

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private Runner runner() {
        Runner r = new Runner();
        r.setId(1L);
        r.setEmail("runner@hermes.test");
        return r;
    }

    private Shoe shoe(Long id, Runner runner) {
        Shoe s = new Shoe();
        s.setId(id);
        s.setRunner(runner);
        s.setBrand("Nike");
        s.setModel("Pegasus 41");
        s.setInitialDistanceKm(0.0);
        return s;
    }

    private ShoeController controller(AuthService auth, ShoeRepository shoeRepo,
                                      ActivityRepository actRepo,
                                      ShoeIdentityService identSvc) {
        return new ShoeController(auth, shoeRepo, actRepo, identSvc);
    }

    private ShoeController controller(AuthService auth, ShoeRepository shoeRepo,
                                      ActivityRepository actRepo,
                                      ShoeIdentityService identSvc,
                                      ShoeCatalogModelRepository catalogRepo) {
        return new ShoeController(auth, shoeRepo, actRepo, identSvc, catalogRepo);
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

    private ShoeController defaultController(AuthService auth) {
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        when(actRepo.sumDistanceKmByRunner(any())).thenReturn(Collections.emptyList());
        when(actRepo.findLastUsedDateByRunner(any())).thenReturn(Collections.emptyList());
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        return controller(auth, shoeRepo, actRepo, identSvc);
    }

    @SuppressWarnings("unchecked")
    private void assertErrorMap(ResponseEntity<?> resp, HttpStatus status, String message) {
        assertThat(resp.getStatusCode()).isEqualTo(status);
        assertThat(resp.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, Object>) resp.getBody()).containsEntry("error", message);
    }

    // ---------------------------------------------------------------------------
    // GET /api/shoes — list shoes
    // ---------------------------------------------------------------------------

    @Test
    void listShoesReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ShoeController ctrl = defaultController(auth);

        ResponseEntity<?> resp = ctrl.listShoes(null, false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isEqualTo("Invalid Session");
    }

    @Test
    void listShoesReturnsActiveShoesList() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe shoe = shoe(10L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(shoe));
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .listShoes("Bearer token", false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isInstanceOf(List.class);
        assertThat((List<?>) resp.getBody()).hasSize(1);
    }

    @Test
    void listShoesAddsRotationSurfaceAndLastWearMetadata() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        ShoeCatalogModelRepository catalogRepo = mock(ShoeCatalogModelRepository.class);
        Runner runner = runner();
        Shoe shoe = shoe(10L, runner);
        shoe.setBrand("HOKA");
        shoe.setModel("Speedgoat 6");
        LocalDateTime lastWorn = LocalDateTime.now().minusDays(4);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(shoe));
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());
        when(actRepo.findLastUsedDateByRunner(runner)).thenReturn(List.<Object[]>of(new Object[] { 10L, lastWorn }));
        when(catalogRepo.findAll()).thenReturn(List.of(catalogModel("HOKA", "Speedgoat 6", "trail")));

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc, catalogRepo)
                .listShoes("Bearer token", false);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        List<Shoe> body = (List<Shoe>) resp.getBody();
        Shoe enriched = body.get(0);
        assertThat(enriched.getType()).isEqualTo("trail");
        assertThat(enriched.getSurfaceType()).isEqualTo("trail");
        assertThat(enriched.getLastWornAt()).isEqualTo(lastWorn);
        assertThat(enriched.getDaysSinceLastWear()).isBetween(3, 5);
    }

    @Test
    void recommendationInfersTrailSurfaceFromTodaysScheduledWorkout() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        ShoeCatalogModelRepository catalogRepo = mock(ShoeCatalogModelRepository.class);
        ShoeTracker shoeTracker = mock(ShoeTracker.class);
        CoachScheduledWorkoutRepository scheduleRepo = mock(CoachScheduledWorkoutRepository.class);
        Runner runner = runner();
        Shoe recommended = shoe(11L, runner);
        recommended.setBrand("Saucony");
        recommended.setModel("Peregrine 14");
        recommended.setType("trail");
        recommended.setSurfaceType("trail");
        recommended.setCurrentDistanceKm(30.0);
        recommended.setMaxDistanceKm(650.0);
        recommended.setDaysSinceLastWear(6);
        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setRunner(runner);
        workout.setScheduledDate(LocalDate.now());
        workout.setWorkoutType(CoachWorkoutType.EASY);
        workout.setNotes("Trail route on soft surface");

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(scheduleRepo.findByRunnerAndScheduledDate(runner, LocalDate.now())).thenReturn(Optional.of(workout));
        when(shoeTracker.recommendShoe(runner, CoachWorkoutType.EASY, "trail")).thenReturn(Optional.of(recommended));

        ResponseEntity<?> resp = new ShoeController(
                auth,
                shoeRepo,
                actRepo,
                identSvc,
                catalogRepo,
                shoeTracker,
                scheduleRepo
        ).recommendation("Bearer token", null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body)
                .containsEntry("targetSurface", "trail")
                .containsEntry("targetSurfaceSource", "schedule")
                .containsEntry("scheduledWorkoutType", CoachWorkoutType.EASY.name());
        @SuppressWarnings("unchecked")
        Map<String, Object> shoe = (Map<String, Object>) body.get("recommendedShoe");
        assertThat(shoe)
                .containsEntry("id", 11L)
                .containsEntry("surfaceType", "trail")
                .containsEntry("daysSinceLastWear", 6);
    }

    @Test
    void listShoesWithIncludeRetiredUsesAllShoesQuery() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe active = shoe(10L, runner);
        Shoe retired = shoe(11L, runner);
        retired.setRetired(true);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerOrderByCreatedAtDesc(runner)).thenReturn(List.of(active, retired));
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .listShoes("Bearer token", true);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(shoeRepo).findByRunnerOrderByCreatedAtDesc(runner);
        verify(shoeRepo, never()).findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
    }

    // ---------------------------------------------------------------------------
    // GET /api/shoes/duplicate-clusters
    // ---------------------------------------------------------------------------

    @Test
    void duplicateClustersReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).duplicateClusters(null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void duplicateClustersReturnsEmptyClustersWhenNoShares() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseAndIdentityKeyNotNull(runner)).thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .duplicateClusters("Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsKey("clusters");
        assertThat((List<?>) body.get("clusters")).isEmpty();
    }

    // ---------------------------------------------------------------------------
    // POST /api/shoes — create shoe
    // ---------------------------------------------------------------------------

    @Test
    void createShoeReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth)
                .createShoe(null, Map.of("brand", "Nike", "model", "Pegasus 41"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createShoeReturns400WhenBrandMissing() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        ResponseEntity<?> resp = defaultController(auth)
                .createShoe("Bearer token", Map.of("model", "Pegasus 41"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns400WhenModelMissing() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        ResponseEntity<?> resp = defaultController(auth)
                .createShoe("Bearer token", Map.of("brand", "Nike"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns400WhenUnexpectedFieldPresent() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        ResponseEntity<?> resp = defaultController(auth).createShoe(
                "Bearer token",
                Map.of("brand", "Nike", "model", "Pegasus 41", "hackerField", "bad")
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns400WhenBrandTooLong() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        String longBrand = "A".repeat(101);

        ResponseEntity<?> resp = defaultController(auth).createShoe(
                "Bearer token",
                Map.of("brand", longBrand, "model", "Pegasus 41")
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns400WhenMaxDistanceKmNegative() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        ResponseEntity<?> resp = defaultController(auth).createShoe(
                "Bearer token",
                Map.of("brand", "Nike", "model", "Pegasus 41", "maxDistanceKm", -1)
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns400WhenMaxDistanceKmExceedsLimit() {
        AuthService auth = mock(AuthService.class);
        Runner runner = runner();
        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        ResponseEntity<?> resp = defaultController(auth).createShoe(
                "Bearer token",
                Map.of("brand", "Nike", "model", "Pegasus 41", "maxDistanceKm", 100000)
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createShoeReturns201WithSavedShoe() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe saved = shoe(42L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(saved);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc).createShoe(
                "Bearer token",
                Map.of("brand", "Nike", "model", "Pegasus 41")
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isInstanceOf(Shoe.class);
        assertThat(((Shoe) resp.getBody()).getId()).isEqualTo(42L);
    }

    // ---------------------------------------------------------------------------
    // PUT /api/shoes/{id} — update shoe
    // ---------------------------------------------------------------------------

    @Test
    void updateShoeReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth)
                .updateShoe(1L, null, Map.of("brand", "Adidas"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void updateShoeReturns404WhenShoeNotOwnedByRunner() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(99L, "Bearer token", Map.of("brand", "Adidas"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Shoe not found");
    }

    @Test
    void updateShoeReturns400WhenUnexpectedFieldPresent() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("brand", "Adidas", "hackerField", "bad"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateShoeReturns400WhenBrandTooLong() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));

        String longBrand = "B".repeat(101);
        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("brand", longBrand));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateShoeReturns400WhenNicknameTooLong() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));

        String longNick = "N".repeat(81);
        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("nickname", longNick));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).isEqualTo("Nickname too long.");
    }

    @Test
    void updateShoeReturns200WithUpdatedShoe() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(existing);
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(50.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("brand", "Adidas"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isInstanceOf(Shoe.class);
    }

    @Test
    void updateShoeCurrentDistanceKmIncludesActivityAndInitialDistance() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);
        existing.setInitialDistanceKm(100.0);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(existing);
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(250.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("brand", "Nike"));

        Shoe body = (Shoe) resp.getBody();
        assertThat(body.getCurrentDistanceKm()).isEqualTo(350.0);
    }

    @Test
    void updateShoeRetiredTrueSetsRetiredDate() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(existing);
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(0.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("retired", true));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isRetired()).isTrue();
        assertThat(existing.getRetiredDate()).isNotNull();
    }

    @Test
    void updateShoeRetiredFalseClearsRetiredDate() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);
        existing.setRetired(true);
        existing.setRetiredDate(LocalDateTime.now().minusDays(14));

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(existing);
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(0.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .updateShoe(5L, "Bearer token", Map.of("retired", false));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isRetired()).isFalse();
        assertThat(existing.getRetiredDate()).isNull();
    }

    // ---------------------------------------------------------------------------
    // DELETE /api/shoes/{id}
    // ---------------------------------------------------------------------------

    @Test
    void deleteShoeReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).deleteShoe(1L, false, null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void deleteShoeReturns404WhenShoeNotOwnedByRunner() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(77L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .deleteShoe(77L, false, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Shoe not found");
    }

    @Test
    void deleteShoeWithoutPermanentFlagSoftDeletesShoe() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(existing);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .deleteShoe(5L, false, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoe retired");
        verify(shoeRepo).save(existing);
        verify(shoeRepo, never()).delete(existing);
    }

    @Test
    void deleteShoeWithPermanentFlagHardDeletesShoeAndUnlinksActivities() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .deleteShoe(5L, true, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoe deleted");
        verify(actRepo).unlinkShoeFromActivities(5L);
        verify(shoeRepo).delete(existing);
    }

    // ---------------------------------------------------------------------------
    // POST /api/shoes/match-batch
    // ---------------------------------------------------------------------------

    @Test
    void matchBatchReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth)
                .matchBatch(null, Map.of("items", List.of()));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void matchBatchReturns400WhenUnexpectedFieldInBody() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .matchBatch("Bearer token", Map.of("items", List.of(), "hackerField", "bad"));

        assertErrorMap(resp, HttpStatus.BAD_REQUEST, "Unexpected fields: hackerField");
    }

    @Test
    void matchBatchReturnsResultsForEachItem() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());
        when(identSvc.computeIdentityKey("Nike", "Pegasus 41")).thenReturn("nike-pegasus-41");

        List<Map<String, Object>> items = List.of(Map.of("brand", "Nike", "model", "Pegasus 41"));
        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .matchBatch("Bearer token", Map.of("items", items));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsKey("results");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) body.get("results");
        assertThat(results).hasSize(1);
        assertThat(results.get(0)).containsEntry("index", 0);
        assertThat(results.get(0)).containsEntry("identityKey", "nike-pegasus-41");
    }

    // ---------------------------------------------------------------------------
    // POST /api/shoes/merge
    // ---------------------------------------------------------------------------

    @Test
    void mergeShoesReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).mergeShoes(null,
                Map.of("keepShoeId", 1, "mergeShoeIds", List.of(2)));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void mergeShoesReturns404WhenKeeperNotFound() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(eq(1L), eq(runner))).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc).mergeShoes(
                "Bearer token",
                Map.of("keepShoeId", 1, "mergeShoeIds", List.of(2))
        );

        assertErrorMap(resp, HttpStatus.NOT_FOUND, "Keeper shoe not found");
    }

    @Test
    void mergeShoesReturns400WhenMergeIdsContainsOnlyKeepId() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe keeper = shoe(1L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(eq(1L), eq(runner))).thenReturn(Optional.of(keeper));

        // mergeShoeIds contains only the keepShoeId itself — should result in "No merge targets"
        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc).mergeShoes(
                "Bearer token",
                Map.of("keepShoeId", 1, "mergeShoeIds", List.of(1))
        );

        assertErrorMap(resp, HttpStatus.BAD_REQUEST, "No merge targets");
    }

    @Test
    void mergeShoesReturns404WhenMergeTargetNotFound() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe keeper = shoe(1L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(eq(1L), eq(runner))).thenReturn(Optional.of(keeper));
        when(shoeRepo.findByIdAndRunner(eq(2L), eq(runner))).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc).mergeShoes(
                "Bearer token",
                Map.of("keepShoeId", 1, "mergeShoeIds", List.of(2))
        );

        assertErrorMap(resp, HttpStatus.NOT_FOUND, "Merge shoe not found: 2");
    }

    @Test
    void mergeShoesReturns200WithMergedShoeId() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe keeper = shoe(1L, runner);
        Shoe merged = shoe(2L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(eq(1L), eq(runner))).thenReturn(Optional.of(keeper));
        when(shoeRepo.findByIdAndRunner(eq(2L), eq(runner))).thenReturn(Optional.of(merged));
        when(shoeRepo.save(any(Shoe.class))).thenReturn(keeper);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc).mergeShoes(
                "Bearer token",
                Map.of("keepShoeId", 1, "mergeShoeIds", List.of(2))
        );

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoes merged");
        assertThat(body).containsEntry("keepShoeId", 1L);
        verify(actRepo).reassignActivitiesToShoe(eq(runner), eq(keeper), eq(2L));
        verify(shoeRepo).delete(merged);
    }

    // ---------------------------------------------------------------------------
    // PATCH /api/shoes/{shoeId}/assign/{activityId}
    // ---------------------------------------------------------------------------

    @Test
    void assignShoeToActivityReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).assignShoeToActivity(1L, 10L, null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void assignShoeToActivityReturns404WhenActivityNotFound() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(actRepo.findByIdAndRunner(10L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .assignShoeToActivity(1L, 10L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Activity not found");
    }

    @Test
    void assignShoeToActivityReturns404WhenShoeNotOwnedByRunner() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Activity activity = mock(Activity.class);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(actRepo.findByIdAndRunner(10L, runner)).thenReturn(Optional.of(activity));
        when(shoeRepo.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .assignShoeToActivity(99L, 10L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Shoe not found");
    }

    @Test
    void assignShoeToActivityWithShoeIdZeroUnassignsShoe() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Activity activity = mock(Activity.class);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(actRepo.findByIdAndRunner(10L, runner)).thenReturn(Optional.of(activity));
        when(actRepo.save(activity)).thenReturn(activity);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .assignShoeToActivity(0L, 10L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoe assignment updated");
        verify(activity).setShoe(null);
        verify(actRepo).save(activity);
    }

    @Test
    void assignShoeToActivityAssignsShoeToActivity() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Activity activity = mock(Activity.class);
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(actRepo.findByIdAndRunner(10L, runner)).thenReturn(Optional.of(activity));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(actRepo.save(activity)).thenReturn(activity);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .assignShoeToActivity(5L, 10L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(activity).setShoe(existing);
        verify(actRepo).save(activity);
    }

    // ---------------------------------------------------------------------------
    // GET /api/shoes/recent
    // ---------------------------------------------------------------------------

    @Test
    void recentShoesReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).recentShoes(null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void recentShoesReturnsSortedShoeList() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe shoe = shoe(10L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(new java.util.ArrayList<>(List.of(shoe)));
        when(actRepo.findLastUsedDateByRunner(runner)).thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .recentShoes("Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isInstanceOf(List.class);
        assertThat((List<?>) resp.getBody()).hasSize(1);
    }
}
