package com.hermes.backend.shoes;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.runner.Runner;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ShoeInventoryHttpTests {
    private final ShoeRepository shoes = mock(ShoeRepository.class);
    private final ActivityRepository activities = mock(ActivityRepository.class);
    private final AuthService auth = mock(AuthService.class);
    private final Runner runner = new Runner("shoe-http@hermes.test", "active");
    private final ShoeIdentityService identity = spy(new ShoeIdentityService());
    private final ShoeCatalogModelRepository catalog = mock(ShoeCatalogModelRepository.class);
    private final ShoeInventoryService inventory = new ShoeInventoryService(shoes, activities, identity, catalog,
            new ShoeTrackerService(shoes, catalog, activities), mock(CoachScheduledWorkoutRepository.class),
            new ShoeAdminAggregateService(identity, mock(ShoeImageAssetService.class)));
    private final ShoeController controller = new ShoeController(auth, inventory);
    private MockMvc mvc;
    private Shoe existing;

    @BeforeEach
    void setUp() {
        runner.setId(1L);
        existing = new Shoe();
        existing.setId(7L);
        existing.setRunner(runner);
        existing.setBrand("Nike");
        existing.setModel("Pegasus 41");
        existing.setNickname("Daily");
        existing.setInitialDistanceKm(20.0);
        existing.setMaxDistanceKm(650.0);
        existing.setPhotoUrl("https://cdn.example.com/old.png");
        when(auth.findByAuthorizationHeader("Bearer inventory-test")).thenReturn(Optional.of(runner));
        when(shoes.findByIdAndRunner(7L, runner)).thenReturn(Optional.of(existing));
        when(shoes.save(any(Shoe.class))).thenAnswer(call -> {
            Shoe shoe = call.getArgument(0);
            if (shoe.getId() == null) shoe.setId(8L);
            return shoe;
        });
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void nullableUpdatesDistinguishOmissionClearingAndIgnoredNonStringNames() {
        controller.updateShoe(7L, "Bearer inventory-test", Map.of());
        assertThat(existing.getNickname()).isEqualTo("Daily");
        assertThat(existing.getPhotoUrl()).isEqualTo("https://cdn.example.com/old.png");
        Map<String, Object> changes = new HashMap<>();
        changes.put("brand", 42);
        changes.put("model", null);
        changes.put("nickname", null);
        changes.put("photoUrl", false);
        changes.put("maxDistanceKm", null);
        changes.put("initialDistanceKm", null);
        changes.put("isPrimary", true);
        changes.put("retired", true);

        ResponseEntity<?> response = controller.updateShoe(7L, "Bearer inventory-test", changes);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.getBrand()).isEqualTo("Nike");
        assertThat(existing.getModel()).isEqualTo("Pegasus 41");
        assertThat(existing.getNickname()).isNull();
        assertThat(existing.getPhotoUrl()).isNull();
        assertThat(existing.getInitialDistanceKm()).isEqualTo(20.0);
        assertThat(existing.getMaxDistanceKm()).isEqualTo(650.0);
        assertThat(existing.isRetired()).isTrue();
        assertThat(existing.getIsPrimary()).isTrue();
    }

    @Test
    void photoValidationRetainsAllowedReferencesAndRejectsUnsafeReferences() {
        for (String photo : List.of("https://cdn.example.com/shoe.png", "data:image/png;base64,AAAA",
                "data:application/pdf;base64,AAAA")) {
            ResponseEntity<?> created = controller.createShoe("Bearer inventory-test",
                    Map.of("brand", "Nike", "model", "Pegasus", "photoUrl", photo));
            assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(((Shoe) created.getBody()).getPhotoUrl()).isEqualTo(photo);
            assertThat(controller.updateShoe(7L, "Bearer inventory-test", Map.of("photoUrl", photo)).getStatusCode())
                    .isEqualTo(HttpStatus.OK);
        }
        for (String photo : List.of("javascript:alert(1)", "http://localhost/shoe.png",
                "data:text/html;base64,AAAA", "data:image/png;base64,!!!")) {
            assertThat(controller.createShoe("Bearer inventory-test",
                    Map.of("brand", "Nike", "model", "Pegasus", "photoUrl", photo)).getStatusCode())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(controller.updateShoe(7L, "Bearer inventory-test", Map.of("photoUrl", photo)).getStatusCode())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    @Test
    void photoLengthKeepsCreateRawLimitAndUpdateTrimmedLimit() {
        String prefix = "data:image/png;base64,";
        String exact = prefix + "A".repeat(2_000_000 - prefix.length());
        assertThat(controller.createShoe("Bearer inventory-test",
                Map.of("brand", "Nike", "model", "Pegasus", "photoUrl", exact)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        ResponseEntity<?> created = controller.createShoe("Bearer inventory-test",
                Map.of("brand", "Nike", "model", "Pegasus", "photoUrl", " " + exact));
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(created.getBody()).isEqualTo("Photo URL too long.");
        assertThat(controller.updateShoe(7L, "Bearer inventory-test", Map.of("photoUrl", " " + exact)).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        ResponseEntity<?> updated = controller.updateShoe(7L, "Bearer inventory-test", Map.of("photoUrl", exact + "A"));
        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(updated.getBody()).isEqualTo("photoUrl too long.");
    }

    @Test
    void matchBatchRetainsObjectErrorsAndNullPairFallbacks() throws Exception {
        mvc.perform(post("/api/shoes/match-batch").header("Authorization", "Bearer inventory-test")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"brand\":null,\"model\":4}]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.results[0].index").value(0))
                .andExpect(jsonPath("$.results[0].identityKey").value("na"))
                .andExpect(jsonPath("$.results[0].matches").isArray());
        mvc.perform(post("/api/shoes/match-batch").header("Authorization", "Bearer inventory-test")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"items\":[{\"extra\":true}]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Unexpected fields: extra"));
    }

    @Test
    void earlierMatchFailurePropagatesBeforeLaterItemValidation() {
        existing.setIdentityKey("nikepegasus41");
        when(shoes.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner)).thenReturn(List.of(existing));
        doThrow(new IllegalArgumentException("injected matching failure")).when(identity)
                .computeIdentityKey("Nike", "Fail");

        assertThatThrownBy(() -> controller.matchBatch("Bearer inventory-test",
                Map.of("items", List.of(Map.of("brand", "Nike", "model", "Fail"), Map.of("unexpected", true)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("injected matching failure");
    }

    @Test
    void assignmentUnassignsAndSerializesNullShoeFields() throws Exception {
        Activity activity = new Activity();
        activity.setId(12L);
        activity.setRunner(runner);
        activity.setShoe(existing);
        when(activities.findByIdAndRunner(12L, runner)).thenReturn(Optional.of(activity));
        when(activities.saveAndFlush(activity)).thenReturn(activity);

        mvc.perform(patch("/api/shoes/0/assign/12").header("Authorization", "Bearer inventory-test"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"message\":\"Shoe assignment updated\",\"activityId\":12,\"shoeId\":null,\"shoeName\":null}"));
        assertThat(activity.getShoe()).isNull();
        verify(activities).saveAndFlush(activity);
    }

    @Test
    void routesPreserveOwnershipBeforeUpdateValidationAndMergeErrorShape() throws Exception {
        mvc.perform(put("/api/shoes/99").header("Authorization", "Bearer inventory-test")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"extra\":true}"))
                .andExpect(status().isNotFound()).andExpect(content().string("Shoe not found"));
        mvc.perform(post("/api/shoes/merge").header("Authorization", "Bearer inventory-test")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"keepShoeId\":99,\"mergeShoeIds\":[99]}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("Keeper shoe not found"));
        mvc.perform(get("/api/shoes")).andExpect(status().isUnauthorized())
                .andExpect(content().string("Invalid Session"));
    }

    @Test
    void emptyRecommendationRetainsAllNullablePayloadFields() throws Exception {
        mvc.perform(get("/api/shoes/recommendation").header("Authorization", "Bearer inventory-test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduledDate").exists())
                .andExpect(content().json("{\"scheduledWorkoutType\":null,\"targetSurface\":null,\"targetSurfaceSource\":\"rotation\",\"recommendedShoe\":null}"));
    }
}
