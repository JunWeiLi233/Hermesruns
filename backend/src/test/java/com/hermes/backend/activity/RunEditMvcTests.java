package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.PersonalRecordService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The title and the notes of a run, and the one answer that holds everything the edit drawer shows, through the real servlet
 * stack: security, ownership, what is refused and what a refusal leaves alone. (The rating and its use for the effort score are
 * in TrainingEndpointsMvcTests, the run type and tags in RunLabelsMvcTests.)
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:run-edit-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RunEditMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private TtlCacheStore cacheStore;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("edit-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner, String name) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName(name);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.STRAVA);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run.setDistanceMeters(5000.0);
        return activities.saveAndFlush(run);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder edit(Activity run, Runner as, String body) {
        return json(patch("/api/activities/{id}", run.getId()).header("Authorization", bearer(as)), body);
    }

    private Activity reload(Activity run) {
        return activities.findById(run.getId()).orElseThrow();
    }

    // --- the title -----------------------------------------------------------------------------------------------

    @Test
    void aRunnerRenamesARunAndTheNewTitleIsWhatEveryReadShows() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"name\":\"  Sunday   long run \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(run.getId()))
                .andExpect(jsonPath("$.name").value("Sunday long run"))
                .andExpect(jsonPath("$.notes").doesNotExist());

        assertThat(reload(run).getName()).isEqualTo("Sunday long run");
        mockMvc.perform(get("/api/activities").param("id", String.valueOf(run.getId())).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sunday long run"));
        mockMvc.perform(get("/api/activities").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$[0].name").value("Sunday long run"));
    }

    @Test
    void theNotesAreOnTheRunsOwnReadAndNeverInAList() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");
        mockMvc.perform(edit(run, owner, "{\"notes\":\"private thoughts\"}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/activities").param("id", String.valueOf(run.getId())).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.notes").value("private thoughts"));
        mockMvc.perform(get("/api/activities").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$[0].notes").doesNotExist());
        mockMvc.perform(get("/api/activities/analysis").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private thoughts"))));
    }

    @Test
    void aRenamedRunIsMarkedSoAStravaResyncLeavesItsTitleAlone() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");
        assertThat(run.isNameEdited()).isFalse();

        mockMvc.perform(edit(run, owner, "{\"name\":\"My own title\"}")).andExpect(status().isOk());

        assertThat(reload(run).isNameEdited()).isTrue();
    }

    @Test
    void sayingTheTitleItAlreadyHasIsNotARename() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"name\":\"Afternoon Run\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Afternoon Run"));

        assertThat(reload(run).isNameEdited()).as("Strava's own title is still Strava's").isFalse();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "nothing|{\"name\":null}",
            "an empty title|{\"name\":\"\"}",
            "only spaces|{\"name\":\"   \"}",
            "a number|{\"name\":42}",
            "a list|{\"name\":[\"a\"]}",
            "a control character|{\"name\":\"bell\\u0007\"}",
            "too long|{\"name\":\"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\"}"
    })
    void aTitleThatIsNotATitleIsRefusedAndTheRunIsLeftAlone(String what, String body) throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NAME"))
                .andExpect(jsonPath("$.error").isNotEmpty());

        Activity unchanged = reload(run);
        assertThat(unchanged.getName()).isEqualTo("Afternoon Run");
        assertThat(unchanged.isNameEdited()).isFalse();
    }

    @Test
    void aRenameDropsTheCachedRecordsBecauseTheyShowRunNamesButNotesDoNot() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");
        String key = String.valueOf(owner.getId());
        cacheStore.put(PersonalRecordService.CACHE_NAMESPACE, key, "records as they were", Duration.ofMinutes(5));

        mockMvc.perform(edit(run, owner, "{\"notes\":\"windy\"}")).andExpect(status().isOk());
        assertThat(cacheStore.get(PersonalRecordService.CACHE_NAMESPACE, key, String.class)).as("notes are not in the records").isPresent();

        mockMvc.perform(edit(run, owner, "{\"name\":\"Windy 5K\"}")).andExpect(status().isOk());
        assertThat(cacheStore.get(PersonalRecordService.CACHE_NAMESPACE, key, String.class)).isEmpty();
    }

    // --- the notes -----------------------------------------------------------------------------------------------

    @Test
    void aRunnerWritesNotesOnARunReadsThemBackAndClearsThem() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"notes\":\"Felt heavy.\\r\\n\\r\\nLegs were tired.  \\n\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value("Felt heavy.\n\nLegs were tired."))
                .andExpect(jsonPath("$.name").doesNotExist());
        assertThat(reload(run).getNotes()).isEqualTo("Felt heavy.\n\nLegs were tired.");
        assertThat(reload(run).isNameEdited()).as("notes are not a rename").isFalse();
        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.notes").value("Felt heavy.\n\nLegs were tired."));

        mockMvc.perform(edit(run, owner, "{\"notes\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").doesNotExist());
        assertThat(reload(run).getNotes()).isNull();

        mockMvc.perform(edit(run, owner, "{\"notes\":\"again\"}")).andExpect(status().isOk());
        mockMvc.perform(edit(run, owner, "{\"notes\":\"  \\n \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").doesNotExist());
        assertThat(reload(run).getNotes()).as("only whitespace is no notes").isNull();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "a number|{\"notes\":42}",
            "a list|{\"notes\":[\"a\"]}",
            "a boolean|{\"notes\":true}",
            "a control character|{\"notes\":\"bell\\u0007\"}"
    })
    void notesThatAreNotNotesAreRefusedAndTheRunIsLeftAlone(String what, String body) throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");
        run.setNotes("what I wrote");
        activities.saveAndFlush(run);

        mockMvc.perform(edit(run, owner, body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NOTES"));

        assertThat(reload(run).getNotes()).isEqualTo("what I wrote");
    }

    @Test
    void notesCanBeTwoThousandCharactersAndNotOneMore() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"notes\":\"" + "n".repeat(2000) + "\"}")).andExpect(status().isOk());
        assertThat(reload(run).getNotes()).hasSize(2000);

        mockMvc.perform(edit(run, owner, "{\"notes\":\"" + "m".repeat(2001) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NOTES"));
        assertThat(reload(run).getNotes()).startsWith("n").hasSize(2000);
    }

    // --- several things at once ----------------------------------------------------------------------------------

    @Test
    void oneRequestCanChangeEverythingTheDrawerEdits() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"name\":\"Track night\",\"notes\":\"6 x 800\",\"perceivedExertion\":8,"
                        + "\"useRatingForEffort\":true,\"runType\":\"WORKOUT\",\"tags\":[\"track\",\"intervals\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Track night"))
                .andExpect(jsonPath("$.notes").value("6 x 800"))
                .andExpect(jsonPath("$.perceivedExertion").value(8))
                .andExpect(jsonPath("$.useRatingForEffort").value(true))
                .andExpect(jsonPath("$.runType").value("WORKOUT"))
                .andExpect(jsonPath("$.tags", contains("track", "intervals")));

        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Track night"))
                .andExpect(jsonPath("$.notes").value("6 x 800"))
                .andExpect(jsonPath("$.perceivedExertion").value(8))
                .andExpect(jsonPath("$.useRatingForEffort").value(true))
                .andExpect(jsonPath("$.runType").value("WORKOUT"))
                .andExpect(jsonPath("$.tags", contains("track", "intervals")));
    }

    @Test
    void aRefusedRequestSavesNoneOfItsGoodValues() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"name\":\"Fine title\",\"notes\":\"" + "x".repeat(2001) + "\",\"perceivedExertion\":7}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NOTES"));
        mockMvc.perform(edit(run, owner, "{\"notes\":\"fine\",\"name\":\"\",\"runType\":\"RACE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NAME"));
        mockMvc.perform(edit(run, owner, "{\"name\":\"Fine title\",\"useRatingForEffort\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RATING_REQUIRED"));

        Activity unchanged = reload(run);
        assertThat(unchanged.getName()).isEqualTo("Afternoon Run");
        assertThat(unchanged.getNotes()).isNull();
        assertThat(unchanged.getPerceivedExertion()).isNull();
        assertThat(unchanged.getRunType()).isNull();
        assertThat(unchanged.isNameEdited()).isFalse();
    }

    @Test
    void aFieldThatCannotBeEditedIsStillRefusedNotIgnored() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(edit(run, owner, "{\"name\":\"New\",\"distanceKm\":99}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FIELD"));
        mockMvc.perform(edit(run, owner, "{\"shoeId\":3}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FIELD"));
        assertThat(reload(run).getName()).isEqualTo("Afternoon Run");
        assertThat(reload(run).getDistanceKm()).isEqualTo(5.0);
    }

    // --- GET /api/activities/{id}/edit ---------------------------------------------------------------------------

    @Test
    void theEditAnswerHoldsEverythingTheDrawerShowsAndTheLimitsItChecksAgainst() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, "Afternoon Run");
        mockMvc.perform(edit(run, owner, "{\"tags\":[\"hills\"]}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(run.getId()))
                .andExpect(jsonPath("$.name").value("Afternoon Run"))
                .andExpect(jsonPath("$.notes").doesNotExist())
                .andExpect(jsonPath("$.perceivedExertion").doesNotExist())
                .andExpect(jsonPath("$.useRatingForEffort").value(false))
                .andExpect(jsonPath("$.runType").doesNotExist())
                .andExpect(jsonPath("$.tags", contains("hills")))
                .andExpect(jsonPath("$.shoeId").doesNotExist())
                .andExpect(jsonPath("$.runTypes", contains("RACE", "LONG_RUN", "WORKOUT")))
                .andExpect(jsonPath("$.suggestions", hasSize(1)))
                .andExpect(jsonPath("$.limits.maxNameLength").value(120))
                .andExpect(jsonPath("$.limits.maxNotesLength").value(2000))
                .andExpect(jsonPath("$.limits.maxTags").value(6))
                .andExpect(jsonPath("$.limits.maxTagLength").value(24));
    }

    @Test
    void theEditAnswerNeedsASessionAndYourOwnRun() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(get("/api/activities/{id}/edit", run.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/activities/{id}/edit", -4).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void renamingOrWritingNotesNeedsASessionAndYourOwnRun() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, "Afternoon Run");

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()), "{\"name\":\"x\"}")).andExpect(status().isUnauthorized());
        mockMvc.perform(edit(run, stranger, "{\"name\":\"Not yours\",\"notes\":\"or yours\"}")).andExpect(status().isNotFound());

        Activity unchanged = reload(run);
        assertThat(unchanged.getName()).isEqualTo("Afternoon Run");
        assertThat(unchanged.getNotes()).isNull();
    }
}
