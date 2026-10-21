package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
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
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The run type and the tags of a run through the real servlet stack: security, ownership, what is refused and what a refusal
 * leaves alone, and what deleting a run or an account takes with it.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:run-labels-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RunLabelsMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;
    @Autowired private ActivityTagRepository tags;
    @Autowired private AccountDeletionService accountDeletion;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("labels-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
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

    @Test
    void aRunnerSetsTheTypeAndTheTagsOfARunAndReadsThemBack() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        mockMvc.perform(edit(run, owner, "{\"runType\":\"WORKOUT\",\"tags\":[\"Hill repeats\",\"  with   the dog \"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(run.getId()))
                .andExpect(jsonPath("$.runType").value("WORKOUT"))
                .andExpect(jsonPath("$.tags", contains("Hill repeats", "with the dog")))
                .andExpect(jsonPath("$.perceivedExertion").doesNotExist());

        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runType").value("WORKOUT"))
                .andExpect(jsonPath("$.tags", contains("Hill repeats", "with the dog")))
                .andExpect(jsonPath("$.runTypes", contains("RACE", "LONG_RUN", "WORKOUT")))
                .andExpect(jsonPath("$.maxTags").value(6))
                .andExpect(jsonPath("$.maxTagLength").value(24))
                .andExpect(jsonPath("$.suggestions", hasSize(2)));
        assertThat(activities.findById(run.getId()).orElseThrow().getRunType()).isEqualTo("WORKOUT");
    }

    @Test
    void theListTheAnalysisPagesLoadSaysWhichRunsWereRacesAndLeavesTheOthersUntyped() throws Exception {
        Runner owner = runner();
        Activity race = run(owner);
        Activity easy = run(owner);
        mockMvc.perform(edit(race, owner, "{\"runType\":\"RACE\"}")).andExpect(status().isOk());

        // The whole list and the limited one are two queries; both carry the type.
        for (String url : new String[] {"/api/activities/analysis", "/api/activities/analysis?limit=10"}) {
            mockMvc.perform(get(url).header("Authorization", bearer(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[?(@.id == " + race.getId() + ")].runType", contains("RACE")))
                    .andExpect(jsonPath("$[?(@.id == " + easy.getId() + ")].runType", contains(nullValue())));
        }

        // Clearing the type takes the race out of the list again.
        mockMvc.perform(edit(race, owner, "{\"runType\":null}")).andExpect(status().isOk());
        mockMvc.perform(get("/api/activities/analysis").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$[?(@.id == " + race.getId() + ")].runType", contains(nullValue())));
    }

    @Test
    void aRequestChangesOnlyWhatItNamesAndTheSetOfTagsIsReplacedNotAddedTo() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        mockMvc.perform(edit(run, owner, "{\"runType\":\"LONG_RUN\",\"tags\":[\"a\",\"b\"]}")).andExpect(status().isOk());

        mockMvc.perform(edit(run, owner, "{\"tags\":[\"c\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags", contains("c")))
                .andExpect(jsonPath("$.runType").doesNotExist());
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.runType").value("LONG_RUN"))
                .andExpect(jsonPath("$.tags", contains("c")));

        mockMvc.perform(edit(run, owner, "{\"runType\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runType").doesNotExist());
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.runType").doesNotExist())
                .andExpect(jsonPath("$.tags", contains("c")));

        mockMvc.perform(edit(run, owner, "{\"tags\":null}")).andExpect(status().isOk()).andExpect(jsonPath("$.tags", hasSize(0)));
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.tags", hasSize(0)));
    }

    @Test
    void theRatingAndTheLabelsCanBeSetTogether() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        mockMvc.perform(edit(run, owner, "{\"perceivedExertion\":7,\"runType\":\"RACE\",\"tags\":[\"5k\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perceivedExertion").value(7))
                .andExpect(jsonPath("$.runType").value("RACE"))
                .andExpect(jsonPath("$.tags", contains("5k")));
        assertThat(activities.findById(run.getId()).orElseThrow().getPerceivedExertion()).isEqualTo(7);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "lower case|{\"runType\":\"race\"}",
            "unknown|{\"runType\":\"ULTRA\"}",
            "empty|{\"runType\":\"\"}",
            "a number|{\"runType\":3}",
            "a list|{\"runType\":[\"RACE\"]}",
            "with a space|{\"runType\":\"RACE \"}"
    })
    void aRunTypeThatIsNotOneOfTheThreeIsRefused(String name, String body) throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        mockMvc.perform(edit(run, owner, "{\"runType\":\"WORKOUT\"}")).andExpect(status().isOk());

        mockMvc.perform(edit(run, owner, body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RUN_TYPE"));
        assertThat(activities.findById(run.getId()).orElseThrow().getRunType()).as("unchanged").isEqualTo("WORKOUT");
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "not a list|{\"tags\":\"hills\"}",
            "a number|{\"tags\":5}",
            "numbers in it|{\"tags\":[\"ok\",3]}",
            "an empty tag|{\"tags\":[\"ok\",\"   \"]}",
            "a null in it|{\"tags\":[\"ok\",null]}",
            "too many|{\"tags\":[\"a\",\"b\",\"c\",\"d\",\"e\",\"f\",\"g\"]}",
            "too long|{\"tags\":[\"abcdefghijklmnopqrstuvwxy\"]}",
            "an object in it|{\"tags\":[{\"x\":1}]}"
    })
    void tagsThatBreakARuleAreRefusedAndTheOldOnesStay(String name, String body) throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        mockMvc.perform(edit(run, owner, "{\"tags\":[\"keep\"]}")).andExpect(status().isOk());

        mockMvc.perform(edit(run, owner, body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TAGS"))
                .andExpect(jsonPath("$.error").isString());
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.tags", contains("keep")));
    }

    @Test
    void aRefusedRequestSavesNoneOfItsGoodValues() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        mockMvc.perform(edit(run, owner, "{\"perceivedExertion\":8,\"runType\":\"RACE\",\"tags\":[\"x\",\"\"]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(edit(run, owner, "{\"perceivedExertion\":99,\"runType\":\"RACE\",\"tags\":[\"x\"]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(edit(run, owner, "{\"runType\":\"RACE\",\"distanceKm\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FIELD"));

        Activity unchanged = activities.findById(run.getId()).orElseThrow();
        assertThat(unchanged.getPerceivedExertion()).isNull();
        assertThat(unchanged.getRunType()).isNull();
        assertThat(tags.findAllLabels(owner.getId())).isEmpty();
    }

    @Test
    void theSameWordInAnotherCaseIsOneTag() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        mockMvc.perform(edit(run, owner, "{\"tags\":[\"Hills\",\"hills\",\"HILLS\",\"Track\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags", contains("Hills", "Track")));
        assertThat(tags.findAllLabels(owner.getId())).hasSize(2);
    }

    @Test
    void labelsNeedASessionAndYourOwnRun() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner);
        mockMvc.perform(edit(run, owner, "{\"runType\":\"RACE\",\"tags\":[\"mine\"]}")).andExpect(status().isOk());

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()), "{\"runType\":\"WORKOUT\"}")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(edit(run, stranger, "{\"runType\":\"WORKOUT\",\"tags\":[\"theirs\"]}")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/activities/{id}/labels", run.getId()).header("Authorization", bearer(stranger))).andExpect(status().isNotFound());

        Activity unchanged = activities.findById(run.getId()).orElseThrow();
        assertThat(unchanged.getRunType()).isEqualTo("RACE");
        assertThat(tags.findAllLabels(owner.getId())).hasSize(1);
        assertThat(tags.findAllLabels(stranger.getId())).isEmpty();
    }

    @Test
    void theSuggestionsAreTheRunnersOwnTagsMostUsedFirstAndNobodyElses() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity first = run(owner);
        Activity second = run(owner);
        Activity third = run(owner);
        Activity theirs = run(stranger);
        mockMvc.perform(edit(first, owner, "{\"tags\":[\"Track\",\"easy\"]}")).andExpect(status().isOk());
        mockMvc.perform(edit(second, owner, "{\"tags\":[\"track\",\"hills\"]}")).andExpect(status().isOk());
        mockMvc.perform(edit(third, owner, "{\"tags\":[\"TRACK\"]}")).andExpect(status().isOk());
        mockMvc.perform(edit(theirs, stranger, "{\"tags\":[\"secret plan\"]}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/activities/{id}/labels", third.getId()).header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.suggestions", hasSize(3)))
                .andExpect(jsonPath("$.suggestions[0].tag").value("Track"))
                .andExpect(jsonPath("$.suggestions[0].runs").value(3))
                .andExpect(jsonPath("$.suggestions[1].tag").value("easy"))
                .andExpect(jsonPath("$.suggestions[2].tag").value("hills"));
    }

    @Test
    void deletingARunTakesItsTagsWithItAndDeletingTheAccountTakesAllOfThem() throws Exception {
        Runner owner = runner();
        Activity gone = run(owner);
        Activity kept = run(owner);
        mockMvc.perform(edit(gone, owner, "{\"tags\":[\"one\"]}")).andExpect(status().isOk());
        mockMvc.perform(edit(kept, owner, "{\"tags\":[\"two\"]}")).andExpect(status().isOk());

        assertThat(activityData.deleteActivityForRunner(gone.getId(), owner)).isTrue();
        assertThat(tags.findAllLabels(owner.getId())).extracting(row -> row[1]).containsExactly("two");

        Runner doomed = runner();
        Activity doomedRun = run(doomed);
        mockMvc.perform(edit(doomedRun, doomed, "{\"runType\":\"RACE\",\"tags\":[\"x\",\"y\"]}")).andExpect(status().isOk());
        accountDeletion.deleteAccount(doomed.getId());
        assertThat(tags.findAllLabels(doomed.getId())).isEmpty();
        assertThat(tags.findAllLabels(owner.getId())).as("another runner's tags are not touched").hasSize(1);
    }
}
