package com.hermes.backend.activity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.UUID;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:history-browse;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.open-in-view=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=OFF", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF",
        "app.local-shared-runner.enabled=false", "app.official-course.startup-seed.enabled=false",
        "app.training.async=false", "app.training.catchup-on-startup=false", "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RunHistoryBrowseIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired AuthService auth;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired RunHistoryBrowseService history;
    @Autowired EntityManagerFactory entityManagerFactory;
    final ObjectMapper json = new ObjectMapper();

    @Test void completeHistoryCanBeReadInBoundedPagesWithGlobalAggregatesAndOwnerIsolation() throws Exception {
        Runner runner = runner(); Runner other = runner();
        var records = new ArrayList<Activity>();
        for (int i = 0; i < 605; i++) records.add(run(runner, "Run " + i, "2026-01-01T12:00:00", 1));
        records.add(run(other, "Private other runner", "2026-01-02T12:00:00", 999));
        activities.saveAllAndFlush(records);
        String bearer = "Bearer " + auth.issueSessionToken(runner);
        var stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        var first = history.browse(runner, 60, null, "date", null, null, null, "", "Run");
        assertThat(first.items()).hasSize(60);
        assertThat(first.summary().count()).isEqualTo(605);
        assertThat(first.summary().distanceKm()).isEqualTo(605);
        assertThat(stats.getCollectionFetchCount()).isZero();
        assertThat(stats.getEntityLoadCount()).isLessThanOrEqualTo(64);
        assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        var ids = new HashSet<Long>();
        String cursor = null;
        do {
            var request = get("/api/activities/page").header("Authorization", bearer).param("sort", "date").param("limit", "100");
            if (cursor != null) request.param("cursor", cursor);
            JsonNode page = json.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertThat(page.get("totalCount").asInt()).isEqualTo(605);
            assertThat(page.get("items").size()).isLessThanOrEqualTo(100);
            page.get("items").forEach(item -> assertThat(ids.add(item.get("id").asLong())).isTrue());
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
        } while (cursor != null);
        assertThat(ids).hasSize(605);
        String foreignCursor = first.nextCursor();
        mvc.perform(get("/api/activities/page").header("Authorization", "Bearer " + auth.issueSessionToken(other))
                .param("sort", "date").param("cursor", foreignCursor)).andExpect(status().isConflict());
    }

    @Test void browseMappingRequiresAuthenticationAndKeepsLegacyPageContract() throws Exception {
        mvc.perform(get("/api/activities/page").param("sort", "date")).andExpect(status().isUnauthorized());
        Runner runner = runner();
        activities.saveAndFlush(run(runner, "Run", "2026-10-21T12:00:00", 5));
        String bearer = "Bearer " + auth.issueSessionToken(runner);
        JsonNode legacy = json.readTree(mvc.perform(get("/api/activities/page").header("Authorization", bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(legacy.has("nextBeforeId")).isTrue();
        JsonNode browse = json.readTree(mvc.perform(get("/api/activities/page").header("Authorization", bearer)
                .param("sort", "date").param("limit", "10000"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(browse.has("summary")).isTrue();
        assertThat(browse.get("weeklyDistance").size()).isEqualTo(12);
        mvc.perform(get("/api/activities/page").header("Authorization", bearer).param("sort", "date")
                .param("month", "13")).andExpect(status().isBadRequest());
    }

    @Test void anEditedRunInvalidatesContinuationInsteadOfMixingSnapshots() throws Exception {
        Runner runner = runner();
        Activity a = activities.saveAndFlush(run(runner, "Morning", "2026-10-20T12:00:00", 5));
        activities.saveAndFlush(run(runner, "Older", "2026-10-19T12:00:00", 10));
        String cursor = history.browse(runner, 1, null, "date", null, null, null, "", "Run").nextCursor();
        a.setName("Edited name"); activities.saveAndFlush(a);
        mvc.perform(get("/api/activities/page").header("Authorization", "Bearer " + auth.issueSessionToken(runner))
                .param("sort", "date").param("defaultName", "Run").param("cursor", cursor)).andExpect(status().isConflict());
    }

    private Runner runner() {
        Runner runner = new Runner("history-browse-" + UUID.randomUUID() + "@example.test", "active");
        runner.setTimeZone("America/New_York"); return runners.saveAndFlush(runner);
    }
    private Activity run(Runner runner, String name, String start, double km) {
        Activity activity = new Activity(); activity.setRunner(runner); activity.setActivityType(ActivityType.RUN);
        activity.setName(name); activity.setStartTime(LocalDateTime.parse(start)); activity.setStartDate(start);
        activity.setDistanceKm(km); activity.setMovingTimeSeconds(1800); return activity;
    }
}
