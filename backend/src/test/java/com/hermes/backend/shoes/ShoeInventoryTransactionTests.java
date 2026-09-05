package com.hermes.backend.shoes;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.web.ApiExceptionLoggingAdvice;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:shoe-inventory-transactions;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ShoeInventoryTransactionTests {
    @Autowired private ShoeController controller;
    @Autowired private ApiExceptionLoggingAdvice errors;
    @MockitoSpyBean private ShoeRepository shoes;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;
    @MockitoSpyBean private ShoeIdentityService identity;
    @MockitoSpyBean private AuthService auth;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("shoe-tx-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private Shoe shoe(Runner runner, String model, Double initial, String photo) {
        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        shoe.setBrand("Nike");
        shoe.setModel(model);
        shoe.setInitialDistanceKm(initial);
        shoe.setPhotoUrl(photo);
        return shoes.saveAndFlush(shoe);
    }

    private Activity activity(Runner runner, Shoe shoe) {
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setShoe(shoe);
        activity.setName("Inventory transaction test");
        activity.setDistanceKm(5);
        return activities.saveAndFlush(activity);
    }

    private MockMvc requests(Runner owner, boolean transactional) {
        doAnswer(call -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isEqualTo(transactional);
            return Optional.of(owner);
        }).when(auth).findByAuthorizationHeader("Bearer shoe-tx-test");
        // Use the Spring-proxied controller and the production exception handler.
        return MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(errors).build();
    }

    private MockHttpServletRequestBuilder merge(Shoe keep, Long... targets) {
        String ids = Arrays.stream(targets).map(String::valueOf).collect(Collectors.joining(","));
        return post("/api/shoes/merge").header("Authorization", "Bearer shoe-tx-test")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"keepShoeId\":" + keep.getId() + ",\"mergeShoeIds\":[" + ids + "]}");
    }

    @Test
    void successfulMergeCommitsActivityLinksDeletesAndKeeperTogether() throws Exception {
        Runner owner = runner();
        Shoe keep = shoe(owner, "Keep", 10.0, null);
        Shoe target = shoe(owner, "Target", 12.345, "https://cdn.example.com/target.png");
        Activity linked = activity(owner, target);

        requests(owner, true).perform(merge(keep, target.getId(), target.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Shoes merged"))
                .andExpect(jsonPath("$.keepShoeId").value(keep.getId()));

        Shoe saved = shoes.findById(keep.getId()).orElseThrow();
        assertThat(saved.getInitialDistanceKm()).isEqualTo(22.35);
        assertThat(saved.getPhotoUrl()).isEqualTo(target.getPhotoUrl());
        assertThat(saved.getIdentityKey()).isEqualTo("nikekeep");
        assertThat(shoes.existsById(target.getId())).isFalse();
        assertThat(activities.findById(linked.getId()).orElseThrow().getShoeId()).isEqualTo(keep.getId());
    }

    @Test
    void laterForeignTargetReturns404AndCommitsEarlierTargetsLikeHead() throws Exception {
        Runner owner = runner();
        Shoe keep = shoe(owner, "Keep", 10.0, null);
        Shoe target = shoe(owner, "Target", 20.0, "https://cdn.example.com/target.png");
        Shoe foreign = shoe(runner(), "Foreign", 30.0, null);
        Activity linked = activity(owner, target);

        requests(owner, true).perform(merge(keep, target.getId(), foreign.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Merge shoe not found: " + foreign.getId()));

        Shoe saved = shoes.findById(keep.getId()).orElseThrow();
        assertThat(saved.getPhotoUrl()).isEqualTo(target.getPhotoUrl());
        assertThat(saved.getInitialDistanceKm()).isEqualTo(10.0);
        assertThat(saved.getIdentityKey()).isNull();
        assertThat(shoes.existsById(target.getId())).isFalse();
        assertThat(shoes.existsById(foreign.getId())).isTrue();
        assertThat(activities.findById(linked.getId()).orElseThrow().getShoeId()).isEqualTo(keep.getId());
    }

    @Test
    void unexpectedIdentityIllegalArgumentReturns500AndRollsBackEarlierWrites() throws Exception {
        Runner owner = runner();
        Shoe keep = shoe(owner, "Keep", 10.0, null);
        Shoe target = shoe(owner, "Target", 20.0, "https://cdn.example.com/target.png");
        Activity linked = activity(owner, target);
        doThrow(new IllegalArgumentException("injected identity failure")).when(identity).applyIdentityKey(any(Shoe.class));

        requests(owner, true).perform(merge(keep, target.getId()))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.error").value("Server error"));

        assertThat(shoes.existsById(target.getId())).isTrue();
        Shoe unchanged = shoes.findById(keep.getId()).orElseThrow();
        assertThat(unchanged.getInitialDistanceKm()).isEqualTo(10.0);
        assertThat(unchanged.getPhotoUrl()).isNull();
        assertThat(activities.findById(linked.getId()).orElseThrow().getShoeId()).isEqualTo(target.getId());
    }

    @Test
    void unexpectedLaterRepositoryIllegalArgumentReturns500AndRollsBackEarlierWrites() throws Exception {
        Runner owner = runner();
        Shoe keep = shoe(owner, "Keep", 10.0, null);
        Shoe first = shoe(owner, "First", 20.0, "https://cdn.example.com/first.png");
        Shoe later = shoe(owner, "Later", 30.0, null);
        Activity linked = activity(owner, first);
        doThrow(new IllegalArgumentException("injected lookup failure")).when(shoes)
                .findByIdAndRunner(later.getId(), owner);

        requests(owner, true).perform(merge(keep, first.getId(), later.getId()))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.error").value("Server error"));

        assertThat(shoes.existsById(first.getId())).isTrue();
        assertThat(shoes.existsById(later.getId())).isTrue();
        assertThat(shoes.findById(keep.getId()).orElseThrow().getPhotoUrl()).isNull();
        assertThat(activities.findById(linked.getId()).orElseThrow().getShoeId()).isEqualTo(first.getId());
    }

    @Test
    void assignmentAndPermanentDeleteRetainRequestTransactionsAndNormal404Responses() throws Exception {
        Runner owner = runner();
        Shoe shoe = shoe(owner, "Road", null, null);
        Activity activity = activity(owner, null);
        MockMvc mvc = requests(owner, true);

        mvc.perform(patch("/api/shoes/" + shoe.getId() + "/assign/" + activity.getId())
                        .header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.shoeId").value(shoe.getId()));
        assertThat(activities.findById(activity.getId()).orElseThrow().getShoeId()).isEqualTo(shoe.getId());
        mvc.perform(delete("/api/shoes/" + shoe.getId()).param("permanent", "true")
                        .header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Shoe deleted"));
        assertThat(shoes.existsById(shoe.getId())).isFalse();
        assertThat(activities.findById(activity.getId()).orElseThrow().getShoeId()).isNull();
        mvc.perform(delete("/api/shoes/" + shoe.getId()).header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isNotFound()).andExpect(content().string("Shoe not found"));
        mvc.perform(patch("/api/shoes/" + shoe.getId() + "/assign/" + activity.getId())
                        .header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isNotFound()).andExpect(content().string("Shoe not found"));
        mvc.perform(patch("/api/shoes/0/assign/0").header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isNotFound()).andExpect(content().string("Activity not found"));
    }

    @Test
    void unexpectedDeleteFailureReturns500AndRollsBackActivityUnlink() throws Exception {
        Runner owner = runner();
        Shoe shoe = shoe(owner, "Road", null, null);
        Activity linked = activity(owner, shoe);
        doThrow(new IllegalArgumentException("injected delete failure")).when(shoes).delete(any(Shoe.class));

        requests(owner, true).perform(delete("/api/shoes/" + shoe.getId()).param("permanent", "true")
                        .header("Authorization", "Bearer shoe-tx-test"))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.error").value("Server error"));

        assertThat(shoes.existsById(shoe.getId())).isTrue();
        assertThat(activities.findById(linked.getId()).orElseThrow().getShoeId()).isEqualTo(shoe.getId());
    }

    @Test
    void invalidMatchItemStillCommitsLegacyIdentityBackfillOutsideRequestTransaction() throws Exception {
        Runner owner = runner();
        Shoe existing = shoe(owner, "Pegasus 41", null, null);

        requests(owner, false).perform(post("/api/shoes/match-batch")
                        .header("Authorization", "Bearer shoe-tx-test").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"unexpected\":true}]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Unexpected fields: unexpected"));

        assertThat(shoes.findById(existing.getId()).orElseThrow().getIdentityKey()).isEqualTo("nikepegasus41");
    }

    @Test
    void firstMissingTargetAndEmptyTargetsKeepKnownFailureResponses() throws Exception {
        Runner owner = runner();
        Shoe keep = shoe(owner, "Keep", 10.0, null);
        MockMvc mvc = requests(owner, true);

        mvc.perform(merge(keep, Long.MAX_VALUE)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Merge shoe not found: " + Long.MAX_VALUE));
        mvc.perform(merge(keep, keep.getId())).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("No merge targets"));
        assertThat(shoes.findById(keep.getId()).orElseThrow().getInitialDistanceKm()).isEqualTo(10.0);
    }
}
