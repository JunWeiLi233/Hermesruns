package com.hermes.backend.activity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import com.hermes.backend.shoes.ShoeCatalogBrand;
import com.hermes.backend.shoes.ShoeCatalogBrandRepository;
import com.hermes.backend.shoes.ShoeCatalogController;
import com.hermes.backend.shoes.ShoeCatalogModel;
import com.hermes.backend.shoes.ShoeCatalogModelRepository;
import com.hermes.backend.shoes.ShoeIdentityService;
import com.hermes.backend.shoes.ShoeImageAsset;
import com.hermes.backend.shoes.ShoeImageAssetRepository;
import com.hermes.backend.shoes.ShoeImageAssetService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real authenticated summary JSON and scalar JPA reads against a disposable database. */
@SpringBootTest(properties = {
        "spring.datasource.url=${hermes.performance.datasource.url:jdbc:h2:mem:analysis-summary-time;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE}",
        "spring.datasource.driver-class-name=${hermes.performance.datasource.driver:org.h2.Driver}",
        "spring.datasource.username=${hermes.performance.datasource.username:sa}", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=OFF", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
        "spring.devtools.restart.enabled=false", "app.mail.provider=disabled",
        "app.local-shared-runner.enabled=false", "app.local-shared-runner.seed-mock-data=false",
        "app.official-course.startup-seed.enabled=false", "app.course-map.bulk-scan.enabled=false",
        "app.course-map.bulk-seed.enabled=false", "app.training.async=false",
        "app.training.catchup-on-startup=false", "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AnalysisActivitySummaryTimeTests {
    private static final List<String> TIME_FIELDS = List.of("activityInstant", "timeRepresentation",
            "accountLocalDate", "accountLocalTime", "accountTimeZone");
    @Autowired MockMvc mvc;
    @Autowired AuthService auth;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityDataAccess data;
    @Autowired ShoeRepository shoes;
    @Autowired ShoeCatalogBrandRepository catalogBrands;
    @Autowired ShoeCatalogModelRepository catalogModels;
    @Autowired ShoeImageAssetRepository imageAssets;
    @Autowired EntityManagerFactory entityManagerFactory;
    final ObjectMapper json = new ObjectMapper();

    Runner runner() {
        Runner r = new Runner("analysis-time-" + UUID.randomUUID() + "@hermes.test", "active");
        r.setTimeZone("America/New_York");
        return runners.saveAndFlush(r);
    }
    Activity run(Runner r, String start, boolean strava) {
        Activity a = new Activity();
        a.setRunner(r); a.setName("summary-time-" + UUID.randomUUID());
        a.setActivityType(ActivityType.RUN); a.setProvider(strava ? ImportProvider.STRAVA : ImportProvider.GARMIN);
        a.setStartTime(start == null ? null : LocalDateTime.parse(start)); a.setStartDate(start);
        a.setStravaApiSourced(strava); a.setMovingTimeSeconds(300); a.setDurationSeconds(300L);
        a.setDistanceKm(1.0); a.setDistanceMeters(1000.0); a.setAverageHeartRate(130.0);
        return activities.saveAndFlush(a);
    }
    String bearer(Runner r) { return "Bearer " + auth.issueSessionToken(r); }
    JsonNode summaries(Runner r, Integer limit) throws Exception {
        MockHttpServletRequestBuilder req = get("/api/activities/analysis").header("Authorization", bearer(r));
        if (limit != null) req.param("limit", limit.toString());
        return json.readTree(mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    JsonNode full(Runner r, Activity a) throws Exception {
        return json.readTree(mvc.perform(get("/api/activities").param("id", a.getId().toString())
                .header("Authorization", bearer(r))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    void sameTimeContract(JsonNode summary, JsonNode full) {
        for (String field : TIME_FIELDS) {
            assertThat(summary.has(field)).as("analysis summary field %s", field).isTrue();
            assertThat(summary.get(field)).as(field).isEqualTo(full.get(field));
        }
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void summaryPreservesSourceProvenanceSoDemoRunsCanBeExcluded(boolean bounded) throws Exception {
        Runner r = runner();
        Activity a = run(r, "2026-10-05T03:55:00", false);
        a.setSourceFileName("local-shared-runner-bootstrap");
        activities.saveAndFlush(a);
        assertThat(summaries(r, bounded ? 1 : null).get(0).path("sourceFileName").asText())
                .isEqualTo("local-shared-runner-bootstrap");
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void knownUtcSummaryKeepsTheInstantAndAccountDateAcrossLocalMidnight(boolean bounded) throws Exception {
        Runner r = runner(); Activity a = run(r, "2026-10-05T03:55:00", false);
        JsonNode summary = summaries(r, bounded ? 1 : null).get(0);
        sameTimeContract(summary, full(r, a));
        assertThat(summary.path("activityInstant").asText()).isEqualTo("2026-10-05T03:55:00Z");
        assertThat(summary.path("timeRepresentation").asText()).isEqualTo("UTC_INSTANT");
        assertThat(summary.path("accountLocalDate").asText()).isEqualTo("2026-10-04");
        assertThat(summary.path("accountLocalTime").asText()).isEqualTo("23:55");
        assertThat(summary.path("accountTimeZone").asText()).isEqualTo("America/New_York");
        assertThat(summary.path("startTime").asText()).isEqualTo("2026-10-04T23:55:00");
        assertThat(summary.path("startDate").asText()).isEqualTo("2026-10-04T23:55");
        assertThat(summary.path("startTime")).isEqualTo(full(r, a).path("startTime"));
        assertThat(summary.path("movingTimeSeconds").asInt()).isEqualTo(300);
        assertThat(summary.path("distanceKm").asDouble()).isEqualTo(1);
        assertThat(summary.path("averageHeartRate").asDouble()).isEqualTo(130);
        assertThat(activities.findById(a.getId()).orElseThrow().getStartTime()).isEqualTo(a.getStartTime());
    }
    @ParameterizedTest @ValueSource(booleans = {false, true})
    void legacyStravaSummaryRetainsWallTimeWithoutInventingAnInstant(boolean bounded) throws Exception {
        Runner r = runner(); Activity a = run(r, "2026-10-05T03:55:00", true);
        JsonNode summary = summaries(r, bounded ? 1 : null).get(0);
        sameTimeContract(summary, full(r, a));
        assertThat(summary.get("activityInstant").isNull()).isTrue();
        assertThat(summary.path("timeRepresentation").asText()).isEqualTo("STRAVA_LOCAL_WALL_TIME");
        assertThat(summary.path("accountLocalDate").asText()).isEqualTo("2026-10-05");
        assertThat(summary.path("accountLocalTime").asText()).isEqualTo("03:55");
        assertThat(summary.path("accountTimeZone").asText()).isEqualTo("America/New_York");
        assertThat(summary.path("startTime").asText()).isEqualTo("2026-10-05T03:55:00");
    }
    @Test void missingStartRemainsUnknownInsteadOfInferringAnInstantFromAddedDate() throws Exception {
        Runner r = runner(); Activity a = run(r, null, false);
        JsonNode summary = summaries(r, 1).get(0);
        sameTimeContract(summary, full(r, a));
        assertThat(summary.get("activityInstant").isNull()).isTrue();
        assertThat(summary.get("accountLocalDate").isNull()).isTrue();
        assertThat(summary.get("accountLocalTime").isNull()).isTrue();
        assertThat(summary.path("timeRepresentation").asText()).isEqualTo("UNKNOWN");
    }
    @Test void elapsedRangeCallerGetsTrustedInstantsForPastAndFutureRows() throws Exception {
        Runner r = runner();
        Activity past = run(r, "2026-09-14T03:55:00", false); // Sept 13 on the account calendar.
        Activity future = run(r, "2026-10-12T04:00:00", false);
        JsonNode summaries = summaries(r, null);
        assertThat(summaries.size()).isEqualTo(2);
        assertThat(summaries.get(0).path("id").asLong()).isEqualTo(future.getId());
        sameTimeContract(summaries.get(0), full(r, future));
        assertThat(summaries.get(0).path("activityInstant").asText()).isEqualTo("2026-10-12T04:00:00Z");
        assertThat(summaries.get(0).path("accountLocalDate").asText()).isEqualTo("2026-10-12");
        sameTimeContract(summaries.get(1), full(r, past));
        assertThat(summaries.get(1).path("activityInstant").asText()).isEqualTo("2026-09-14T03:55:00Z");
        assertThat(summaries.get(1).path("accountLocalDate").asText()).isEqualTo("2026-09-13");
    }
    @Test void ownerLimitAndRunOnlyFilteringStayInTheScalarQueryWithoutEntityHydration() throws Exception {
        Runner r = runner(), other = runner();
        run(other, "2026-10-12T04:00:00", true);
        Activity cycle = run(r, "2026-10-11T04:00:00", false);
        cycle.setActivityType(ActivityType.NON_RUN); activities.saveAndFlush(cycle);
        List<Activity> owned = new ArrayList<>();
        for (int i = 0; i < 12; i++) owned.add(run(r, "2026-10-10T12:" + String.format("%02d", i) + ":00", i % 2 == 0));
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        List<ActivityRepository.AnalysisActivitySummaryProjection> bounded = data.findAnalysisSummaries(r, 2);
        assertThat(bounded).extracting(ActivityRepository.AnalysisActivitySummaryProjection::getId)
                .containsExactly(owned.get(11).getId(), owned.get(10).getId());
        assertThat(bounded).extracting(ActivityRepository.AnalysisActivitySummaryProjection::getStravaApiSourced)
                .containsExactly(false, true);
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        assertThat(stats.getEntityLoadCount()).isZero(); assertThat(stats.getCollectionFetchCount()).isZero();
        stats.clear();
        assertThat(data.findAnalysisSummaries(r, 0)).hasSize(12);
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        assertThat(stats.getEntityLoadCount()).isZero(); assertThat(stats.getCollectionFetchCount()).isZero();
        JsonNode response = summaries(r, 2);
        assertThat(response.size()).isEqualTo(2);
        assertThat(response.get(0).path("id").asLong()).isEqualTo(owned.get(11).getId());
        assertThat(response.get(1).path("id").asLong()).isEqualTo(owned.get(10).getId());
    }
    @Test void metadataSummaryStillRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/activities/analysis")).andExpect(status().isUnauthorized());
    }

    @Test void historyQueryFetchesDifferentShoesInOneStatementWithoutLoadingPoints() {
        Runner owner = runner();
        List<Activity> runs = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            Shoe shoe = new Shoe(); shoe.setRunner(owner); shoe.setBrand("Brand"); shoe.setModel("Shoe " + i);
            shoe = shoes.saveAndFlush(shoe);
            Activity activity = run(owner, "2026-10-10T12:00:00", false);
            activity.setShoe(shoe); runs.add(activities.saveAndFlush(activity));
        }
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        List<Activity> page = data.findRunsBeforeIdForRunner(owner, runs.get(5).getId(), 3);
        assertThat(page).extracting(Activity::getId).containsExactly(runs.get(4).getId(), runs.get(3).getId(), runs.get(2).getId());
        assertThat(page).extracting(Activity::getShoeName).containsExactly("Brand Shoe 4", "Brand Shoe 3", "Brand Shoe 2");
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        assertThat(stats.getCollectionFetchCount()).isZero();
    }

    @Test void historyCursorKeepsOwnerAndRunFiltersAndIgnoresNewerInserts() throws Exception {
        Runner owner = runner(), other = runner();
        Activity first = run(owner, "2026-10-10T12:00:00", false);
        Activity second = run(owner, "2026-10-11T12:00:00", false);
        Activity third = run(owner, "2026-10-12T12:00:00", false);
        run(other, "2026-10-12T12:00:00", false);
        Activity bike = run(owner, "2026-10-12T12:00:00", false);
        bike.setActivityType(ActivityType.NON_RUN); activities.saveAndFlush(bike);
        String token = bearer(owner);
        JsonNode page = json.readTree(mvc.perform(get("/api/activities/page").param("limit", "2")
                .header("Authorization", token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(page.path("items").size()).isEqualTo(2);
        assertThat(page.at("/items/0/id").asLong()).isEqualTo(third.getId());
        assertThat(page.at("/items/1/id").asLong()).isEqualTo(second.getId());
        assertThat(page.path("hasMore").asBoolean()).isTrue();
        assertThat(page.path("nextBeforeId").asLong()).isEqualTo(second.getId());
        run(owner, "2026-10-13T12:00:00", false);
        JsonNode next = json.readTree(mvc.perform(get("/api/activities/page").param("limit", "2")
                .param("beforeId", page.path("nextBeforeId").asText()).header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(next.path("items").size()).isEqualTo(1);
        assertThat(next.at("/items/0/id").asLong()).isEqualTo(first.getId());
        assertThat(next.path("hasMore").asBoolean()).isFalse();
        assertThat(next.path("nextBeforeId").isNull()).isTrue();
        mvc.perform(get("/api/activities/page")).andExpect(status().isUnauthorized());
    }

    @Test void catalogColdReadUsesThreeQueriesAndWarmReadUsesNone() {
        ShoeCatalogBrand brand = new ShoeCatalogBrand(); brand.setName("Query test " + UUID.randomUUID());
        brand = catalogBrands.saveAndFlush(brand);
        ShoeCatalogModel model = new ShoeCatalogModel(); model.setBrand(brand); model.setName("Road shoe");
        model = catalogModels.saveAndFlush(model);
        ShoeImageAsset image = new ShoeImageAsset();
        image.setIdentityKey(new ShoeIdentityService().computeIdentityKey(brand.getName(), model.getName()));
        image.setLiveImageUrl("https://example.test/live.webp");
        image.setPendingImageUrl("pending image data that is not part of the catalog read");
        imageAssets.saveAndFlush(image);
        ShoeCatalogController catalog = new ShoeCatalogController(null, catalogBrands, catalogModels, null, null,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()),
                new ShoeImageAssetService(imageAssets, shoes));
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        JsonNode cold = json.valueToTree(catalog.listCatalog().getBody());
        assertThat(cold.at("/brands/0/models/0/imageUrl").asText()).isEqualTo("https://example.test/live.webp");
        assertThat(stats.getPrepareStatementCount()).isEqualTo(3);
        stats.clear();
        JsonNode warm = json.valueToTree(catalog.listCatalog().getBody());
        assertThat(warm.toString()).isEqualTo(cold.toString());
        assertThat(stats.getPrepareStatementCount()).isZero();
    }
}
