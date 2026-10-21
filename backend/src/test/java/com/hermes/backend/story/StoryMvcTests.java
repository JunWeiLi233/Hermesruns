package com.hermes.backend.story;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.AccountExportService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:story-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false", "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
@Import(StoryMvcTests.TimeConfiguration.class)
class StoryMvcTests {
    private static final Instant FIRST = Instant.parse("2026-10-10T16:00:00Z");
    @Autowired MockMvc mvc;
    @Autowired RunnerRepository runners;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @Autowired AccountExportService exports;
    @Autowired AccountDeletionService deletion;
    @Autowired StoryClock clock;

    @TestConfiguration
    static class TimeConfiguration {
        @Bean @Primary StoryClock storyClock() { return new StoryClock(); }
    }
    static class StoryClock extends Clock {
        volatile Instant now = FIRST;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
    @BeforeEach void resetTime() { clock.now = FIRST; }
    Runner runner() { return runners.saveAndFlush(new Runner("story-" + UUID.randomUUID() + "@hermes.test", "ACTIVE")); }
    String token(Runner runner) { return "Bearer " + auth.issueSessionToken(runner); }
    String update(String token, String chapter, String body) throws Exception {
        return mvc.perform(post("/api/stories/me/chapters/" + chapter).header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    @Test void freshZeroRunAccountSeesThreeAvailableChaptersWithoutCreatingRows() throws Exception {
        Runner owner = runner();
        mvc.perform(get("/api/stories/me").header("Authorization", token(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("invitation"))
                .andExpect(jsonPath("$.currentPanel").value("shelf"))
                .andExpect(jsonPath("$.chapters.length()").value(3))
                .andExpect(jsonPath("$.chapters[0].chapterId").value("lantern"))
                .andExpect(jsonPath("$.chapters[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.chapters[0].postcardId").isEmpty());
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id = ?", Long.class, owner.getId())).isZero();
    }

    @Test void savesChoiceAndCompletesExactlyOnePostcardAcrossResponseRetryAndThirtyDayBreak() throws Exception {
        String token = token(runner());
        update(token, "lantern", "{\"action\":\"start\"}");
        update(token, "lantern", "{\"action\":\"choose\",\"branch\":\"left\"}");
        String completed = update(token, "lantern", "{\"action\":\"complete\",\"branch\":\"left\"}");
        assertThat(completed).contains("postcard-lantern", "2026-10-10T16:00:00Z");
        clock.now = FIRST.plusSeconds(30 * 86400L);
        assertThat(update(token, "lantern", "{\"action\":\"complete\",\"branch\":\"left\"}")).isEqualTo(completed);
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[0].branch").value("left"))
                .andExpect(jsonPath("$.chapters[0].earnedAt").value(FIRST.toString()))
                .andExpect(jsonPath("$.chapters[0].status").value("COMPLETED"));
    }

    @Test void hideRestoreAndReplayKeepCardsAndOriginalEarnedTime() throws Exception {
        String token = token(runner());
        update(token, "seed-library", "{\"action\":\"start\"}");
        update(token, "seed-library", "{\"action\":\"complete\",\"branch\":\"right\"}");
        for (String mode : List.of("hidden", "open")) {
            mvc.perform(post("/api/stories/me/preferences").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"" + mode + "\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.mode").value(mode))
                    .andExpect(jsonPath("$.chapters[1].postcardId").value("postcard-seed-library"));
        }
        clock.now = FIRST.plusSeconds(21 * 86400L);
        update(token, "seed-library", "{\"action\":\"replay\"}");
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPanel").value("reading"))
                .andExpect(jsonPath("$.chapters[1].branch").isEmpty());
        update(token, "seed-library", "{\"action\":\"complete\",\"branch\":\"left\"}");
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[1].branch").value("left"))
                .andExpect(jsonPath("$.chapters[1].earnedAt").value(FIRST.toString()));
    }

    @Test void simultaneousCompletionsCreateOneAtomicAwardAndDoNotChangeActivities() throws Exception {
        Runner owner = runner();
        String token = token(owner);
        update(token, "last-ferry", "{\"action\":\"start\"}");
        var pool = Executors.newFixedThreadPool(4);
        try {
            List<Callable<String>> calls = new ArrayList<>();
            for (int i = 0; i < 12; i++) calls.add(() -> update(token, "last-ferry", "{\"action\":\"complete\",\"branch\":\"right\"}"));
            for (var result : pool.invokeAll(calls)) assertThat(result.get()).contains("postcard-last-ferry");
        } finally { pool.shutdownNow(); }
        assertThat(jdbc.queryForObject("select count(*) from story_chapter_progress where runner_id = ? and completed_at is not null", Long.class, owner.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id = ?", Long.class, owner.getId())).isZero();
    }

    @Test void unauthenticatedAndForgedOwnerRequestsCannotReadOrChangeAnotherAccount() throws Exception {
        mvc.perform(get("/api/stories/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/stories/me/preferences").contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"open\"}"))
                .andExpect(status().isUnauthorized());
        Runner alice = runner(), bob = runner();
        String a = token(alice), b = token(bob);
        update(a, "lantern", "{\"action\":\"start\"}");
        update(a, "lantern", "{\"action\":\"complete\",\"branch\":\"left\"}");
        update(b, "last-ferry", "{\"action\":\"start\",\"runnerId\":" + alice.getId() + "}");
        mvc.perform(get("/api/stories/me").param("runnerId", alice.getId().toString()).header("Authorization", b))
                .andExpect(status().isOk()).andExpect(jsonPath("$.chapters[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.chapters[2].status").value("IN_PROGRESS"));
        mvc.perform(get("/api/stories/me").header("Authorization", a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[2].status").value("NOT_STARTED"));
    }

    @Test void invalidChoiceChapterActionOrModeCannotGrantCards() throws Exception {
        String token = token(runner());
        update(token, "lantern", "{\"action\":\"start\"}");
        for (String body : List.of("{\"action\":\"complete\"}", "{\"action\":\"choose\",\"branch\":\"other\"}", "{\"action\":\"unknown\"}")) {
            mvc.perform(post("/api/stories/me/chapters/lantern").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/stories/me/chapters/missing").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"start\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/stories/me/preferences").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"mode\":\"daily\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[0].completedAt").isEmpty());
    }

    @Test void unfinishedChoiceRemainsAfterTwentyOneDaysAndAllThreeCanFinishWithoutRuns() throws Exception {
        String token = token(runner());
        update(token, "lantern", "{\"action\":\"start\"}");
        update(token, "lantern", "{\"action\":\"choose\",\"branch\":\"right\"}");
        clock.now = FIRST.plusSeconds(21 * 86400L);
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentChapterId").value("lantern"))
                .andExpect(jsonPath("$.chapters[0].branch").value("right"))
                .andExpect(jsonPath("$.chapters[0].status").value("IN_PROGRESS"));
        for (String chapter : List.of("lantern", "seed-library", "last-ferry")) {
            update(token, chapter, "{\"action\":\"start\"}");
            update(token, chapter, "{\"action\":\"complete\",\"branch\":\"right\"}");
        }
        mvc.perform(get("/api/stories/me").header("Authorization", token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[?(@.status == 'COMPLETED')]").value(org.hamcrest.Matchers.hasSize(3)));
    }

    @Test void accountExportIncludesOnlyOwnersStoryAndAccountDeletionPurgesIt() throws Exception {
        Runner owner = runner(), other = runner();
        String token = token(owner);
        update(token, "lantern", "{\"action\":\"start\"}");
        update(token, "lantern", "{\"action\":\"complete\",\"branch\":\"left\"}");
        update(token(other), "last-ferry", "{\"action\":\"start\"}");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        exports.write(owner, false, out);
        String story = null;
        try (var zip = new ZipInputStream(new ByteArrayInputStream(out.toByteArray()), StandardCharsets.UTF_8)) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) if (entry.getName().equals("stories.json")) story = new String(zip.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(story).contains("postcard-lantern", "left", FIRST.toString()).doesNotContain("IN_PROGRESS", owner.getEmail(), "Bearer");
        deletion.deleteAccount(owner.getId());
        assertThat(jdbc.queryForObject("select count(*) from story_chapter_progress where runner_id = ?", Long.class, owner.getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from story_preferences where runner_id = ?", Long.class, owner.getId())).isZero();
        assertThat(runners.findById(other.getId())).isPresent();
    }
}
