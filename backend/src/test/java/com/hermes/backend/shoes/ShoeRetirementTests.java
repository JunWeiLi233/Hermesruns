package com.hermes.backend.shoes;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ShoeRetirementTests {

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
        ShoeCatalogModelRepository catalogRepo = mock(ShoeCatalogModelRepository.class);
        ShoeTrackerService tracker = new ShoeTrackerService(shoeRepo, catalogRepo, actRepo);
        ShoeAdminAggregateService assets = new ShoeAdminAggregateService(identSvc, mock(ShoeImageAssetService.class));
        ShoeInventoryService inventory = new ShoeInventoryService(shoeRepo, actRepo, identSvc, catalogRepo,
                tracker, mock(com.hermes.backend.coaching.CoachScheduledWorkoutRepository.class), assets);
        return new ShoeController(auth, inventory);
    }

    private ShoeController defaultController(AuthService auth) {
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        when(actRepo.sumDistanceKmByRunner(any())).thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByShoeId(any())).thenReturn(0.0);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        return controller(auth, shoeRepo, actRepo, identSvc);
    }

    // ---------------------------------------------------------------------------
    // POST /api/shoes/{id}/retire
    // ---------------------------------------------------------------------------

    @Test
    void retireShoeReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).retireShoe(1L, null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isEqualTo("Invalid Session");
    }

    @Test
    void retireShoeReturns404WhenShoeNotOwnedByRunner() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .retireShoe(99L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Shoe not found");
    }

    @Test
    void retireShoeSetsRetiredTrueAndSetsRetiredDate() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenAnswer(inv -> inv.getArgument(0));
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(50.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .retireShoe(5L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isRetired()).isTrue();
        assertThat(existing.getRetiredDate()).isNotNull();

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoe retired");
        assertThat(body).containsEntry("shoeId", 5L);
        assertThat(body).containsKey("retiredDate");
    }

    // ---------------------------------------------------------------------------
    // POST /api/shoes/{id}/reactivate
    // ---------------------------------------------------------------------------

    @Test
    void reactivateShoeReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).reactivateShoe(1L, null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isEqualTo("Invalid Session");
    }

    @Test
    void reactivateShoeReturns404WhenShoeNotOwnedByRunner() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .reactivateShoe(99L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isEqualTo("Shoe not found");
    }

    @Test
    void reactivateShoeSetsRetiredFalseAndClearsRetiredDate() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe existing = shoe(5L, runner);
        existing.setRetired(true);
        existing.setRetiredDate(LocalDateTime.now().minusDays(30));

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByIdAndRunner(5L, runner)).thenReturn(Optional.of(existing));
        when(shoeRepo.save(any(Shoe.class))).thenAnswer(inv -> inv.getArgument(0));
        when(actRepo.sumDistanceKmByShoeId(5L)).thenReturn(120.0);

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .reactivateShoe(5L, "Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.isRetired()).isFalse();
        assertThat(existing.getRetiredDate()).isNull();

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertThat(body).containsEntry("message", "Shoe reactivated");
        assertThat(body).containsEntry("shoeId", 5L);
    }

    // ---------------------------------------------------------------------------
    // GET /api/shoes/retired
    // ---------------------------------------------------------------------------

    @Test
    void listRetiredShoesReturns401WhenNoAuth() {
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = defaultController(auth).listRetiredShoes(null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isEqualTo("Invalid Session");
    }

    @Test
    void listRetiredShoesReturnsEmptyListWhenNoRetiredShoes() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredTrueOrderByRetiredDateDesc(runner))
                .thenReturn(Collections.emptyList());
        when(actRepo.sumDistanceKmByRunner(runner)).thenReturn(Collections.emptyList());

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .listRetiredShoes("Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isInstanceOf(List.class);
        assertThat((List<?>) resp.getBody()).isEmpty();
    }

    @Test
    void listRetiredShoesReturnsRetiredShoesWithCurrentDistance() {
        AuthService auth = mock(AuthService.class);
        ShoeRepository shoeRepo = mock(ShoeRepository.class);
        ActivityRepository actRepo = mock(ActivityRepository.class);
        ShoeIdentityService identSvc = mock(ShoeIdentityService.class);
        Runner runner = runner();
        Shoe retired = shoe(10L, runner);
        retired.setRetired(true);
        retired.setRetiredDate(LocalDateTime.now().minusDays(7));

        when(auth.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(shoeRepo.findByRunnerAndRetiredTrueOrderByRetiredDateDesc(runner))
                .thenReturn(List.of(retired));
        when(actRepo.sumDistanceKmByRunner(runner))
                .thenReturn(Collections.singletonList(new Object[]{10L, 350.0}));

        ResponseEntity<?> resp = controller(auth, shoeRepo, actRepo, identSvc)
                .listRetiredShoes("Bearer token");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isInstanceOf(List.class);
        List<?> shoes = (List<?>) resp.getBody();
        assertThat(shoes).hasSize(1);
        assertThat(((Shoe) shoes.get(0)).getCurrentDistanceKm()).isEqualTo(350.0);
    }
}
