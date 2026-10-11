package com.hermes.backend.shoes;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.CoachWorkoutType;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A shoe's type comes from the shoe catalog, which means reading the brand of every catalog model, and that brand is a
 * lazy association. The other shoe tests hand back plain objects from mocked repositories, so the brand is never a lazy
 * proxy there. These use real rows, as production does, with no session left open once the repository call returns.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:shoe-type-from-catalog;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class ShoeTypeFromCatalogTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ShoeRepository shoes;
    @Autowired private ShoeCatalogBrandRepository brands;
    @Autowired private ShoeCatalogModelRepository models;
    @Autowired private ShoeTrackerService tracker;
    @Autowired private TtlCacheStore cache;

    /** The tracker keeps the catalog's types for half an hour; each test seeds catalog rows of its own. */
    @BeforeEach
    void forgetTheCachedCatalog() {
        cache.evict("shoe-catalog-types", "all");
    }

    private Runner runner() {
        Runner runner = new Runner("shoe-type-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** A catalog model of this type under a brand of its own. Only the catalog can say race or speed: a name infers daily. */
    private ShoeCatalogModel catalogModel(String type) {
        ShoeCatalogBrand brand = new ShoeCatalogBrand();
        brand.setName("Brand " + UUID.randomUUID());
        ShoeCatalogModel model = new ShoeCatalogModel();
        model.setBrand(brands.saveAndFlush(brand));
        model.setName("Model " + UUID.randomUUID());
        model.setType(type);
        return models.saveAndFlush(model);
    }

    private Shoe shoe(Runner owner, ShoeCatalogModel model, boolean retired, boolean primary) {
        Shoe shoe = new Shoe();
        shoe.setRunner(owner);
        shoe.setBrand(model.getBrand().getName());
        shoe.setModel(model.getName());
        shoe.setRetired(retired);
        shoe.setIsPrimary(primary);
        return shoes.saveAndFlush(shoe);
    }

    @Test
    void theShoeListGivesEachShoeTheTypeTheCatalogHasForIt() throws Exception {
        Runner owner = runner();
        shoe(owner, catalogModel("race"), false, false);

        mockMvc.perform(get("/api/shoes").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("race"));
    }

    @Test
    void theRecentShoesGiveEachShoeTheTypeTheCatalogHasForIt() throws Exception {
        Runner owner = runner();
        shoe(owner, catalogModel("race"), false, false);

        mockMvc.perform(get("/api/shoes/recent").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("race"));
    }

    @Test
    void theRetiredShoesGiveEachShoeTheTypeTheCatalogHasForIt() throws Exception {
        Runner owner = runner();
        shoe(owner, catalogModel("race"), true, false);

        mockMvc.perform(get("/api/shoes/retired").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("race"));
    }

    @Test
    void aTempoRunGetsTheShoeTheCatalogCallsSpeed() {
        Runner owner = runner();
        Shoe speed = shoe(owner, catalogModel("speed"), false, false);
        shoe(owner, catalogModel("daily"), false, true);

        assertThat(tracker.recommendShoe(owner, CoachWorkoutType.TEMPO)).map(Shoe::getId).contains(speed.getId());
    }
}
