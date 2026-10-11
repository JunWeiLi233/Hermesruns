package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One edit is all of it or none of it, and two edits of one run take turns. A request that fails part-way (after its title, its
 * rating and its tags were already written) leaves the run exactly as it was, and edits made at the same moment, from two tabs,
 * both land: a title saved in one is not undone by the notes saved in the other, and two requests that set the same tag do not
 * collide on the unique index of the tags.
 *
 * <p>The concurrent cases make the bad order certain instead of likely: each request is held, once it has read the run, until
 * the other one has read it too, so that both go on from the same old copy. Without the run's row taken first, both then write
 * back what they read.</p>
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:run-edit-atomic;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RunEditAtomicityTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTagRepository tags;
    @MockitoSpyBean private RunLabelService labelService;
    @MockitoSpyBean private ActivityDataAccess data;

    /** When set, a request that has read its run waits here for the other request to have read it too. */
    private final AtomicReference<CyclicBarrier> bothHaveRead = new AtomicReference<>();

    @BeforeEach
    void holdRequestsThatHaveReadTheRun() {
        doAnswer(call -> {
            Object found = call.callRealMethod();
            CyclicBarrier meeting = bothHaveRead.get();
            if (meeting != null) {
                try {
                    meeting.await(10, TimeUnit.SECONDS);
                } catch (TimeoutException | BrokenBarrierException ended) {
                    // The other request never came: this one goes on alone.
                }
            }
            return found;
        }).when(data).findActivityForRunner(any(), any());
    }

    @AfterEach
    void letRequestsThrough() {
        bothHaveRead.set(null);
        Mockito.reset(data, labelService);
    }

    private Runner runner() {
        return runners.saveAndFlush(new Runner("atomic-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private Activity run(Runner owner) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("Afternoon Run");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.STRAVA);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run.setDistanceMeters(5000.0);
        return activities.saveAndFlush(run);
    }

    /** A session for the runner. Issuing another ends the earlier one, so requests sent together share one. */
    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private MockHttpServletRequestBuilder edit(Activity run, String bearer, String body) {
        return patch("/api/activities/{id}", run.getId())
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    private Activity reload(Activity run) {
        return activities.findById(run.getId()).orElseThrow();
    }

    private List<String> tagsOf(Activity run) {
        return tags.findLabels(List.of(run.getId())).stream().map((row) -> (String) row[1]).toList();
    }

    /** Sends the requests at the same moment, each held after reading the run until all have read it, and returns their statuses. */
    private List<Integer> sendTogether(List<MockHttpServletRequestBuilder> requests) throws Exception {
        bothHaveRead.set(new CyclicBarrier(requests.size()));
        ExecutorService pool = Executors.newFixedThreadPool(requests.size(), (task) -> new Thread(task, "run-edit-request"));
        try {
            List<Future<Integer>> sent = new ArrayList<>();
            for (MockHttpServletRequestBuilder request : requests) {
                sent.add(pool.submit(() -> mockMvc.perform(request).andReturn().getResponse().getStatus()));
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> one : sent) {
                statuses.add(one.get(90, TimeUnit.SECONDS));
            }
            return statuses;
        } finally {
            bothHaveRead.set(null);
            pool.shutdownNow();
        }
    }

    // --- all of it or none of it ---------------------------------------------------------------------------------

    @Test
    void aRequestThatFailsAfterItsStatementsRanLeavesTheRunExactlyAsItWas() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        mockMvc.perform(edit(run, bearer(owner), "{\"tags\":[\"hills\"],\"runType\":\"LONG_RUN\"}")).andExpect(status().isOk());

        // The run's columns were written and its tags replaced; then the answer fails to build. Nothing may stay.
        doAnswer(call -> {
            call.callRealMethod();
            throw new IllegalStateException("the labels could not be read back");
        }).when(labelService).apply(any(), any(), any(), any());
        mockMvc.perform(edit(run, bearer(owner), "{\"name\":\"Track night\",\"notes\":\"6 x 800\",\"perceivedExertion\":8,"
                        + "\"useRatingForEffort\":true,\"runType\":\"WORKOUT\",\"tags\":[\"track\",\"intervals\"]}"))
                .andExpect(status().isInternalServerError());

        Activity unchanged = reload(run);
        assertThat(unchanged.getName()).isEqualTo("Afternoon Run");
        assertThat(unchanged.isNameEdited()).as("the title is still Strava's").isFalse();
        assertThat(unchanged.getNotes()).isNull();
        assertThat(unchanged.getPerceivedExertion()).isNull();
        assertThat(unchanged.isUseRatingForEffort()).isFalse();
        assertThat(unchanged.getRunType()).isEqualTo("LONG_RUN");
        assertThat(tagsOf(run)).containsExactly("hills");
    }

    @Test
    void aRunCanBeEditedAgainAfterARequestFailedPartWay() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        doAnswer(call -> {
            call.callRealMethod();
            throw new IllegalStateException("the labels could not be read back");
        }).when(labelService).apply(any(), any(), any(), any());
        mockMvc.perform(edit(run, bearer(owner), "{\"name\":\"Lost\",\"tags\":[\"gone\"]}")).andExpect(status().isInternalServerError());

        Mockito.reset(labelService);
        mockMvc.perform(edit(run, bearer(owner), "{\"name\":\"Track night\",\"tags\":[\"track\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Track night"));
        assertThat(reload(run).getName()).isEqualTo("Track night");
        assertThat(tagsOf(run)).containsExactly("track");
        mockMvc.perform(get("/api/activities/{id}/edit", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Track night"));
    }

    @Test
    void aRefusalFoundOnTheLockedRowChangesNothingEither() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);

        mockMvc.perform(edit(run, bearer(owner), "{\"name\":\"Fine title\",\"tags\":[\"fine\"],\"useRatingForEffort\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RATING_REQUIRED"));

        Activity unchanged = reload(run);
        assertThat(unchanged.getName()).isEqualTo("Afternoon Run");
        assertThat(unchanged.isNameEdited()).isFalse();
        assertThat(tagsOf(run)).isEmpty();
    }

    // --- two edits at the same moment ----------------------------------------------------------------------------

    @Test
    void aTitleSavedInOneTabIsNotUndoneByNotesSavedInAnother() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        String session = bearer(owner);

        List<Integer> statuses = sendTogether(List.of(
                edit(run, session, "{\"name\":\"Track night\"}"),
                edit(run, session, "{\"notes\":\"6 x 800 with the club\"}")));

        assertThat(statuses).containsExactly(200, 200);
        Activity saved = reload(run);
        assertThat(saved.getName()).isEqualTo("Track night");
        assertThat(saved.isNameEdited()).isTrue();
        assertThat(saved.getNotes()).isEqualTo("6 x 800 with the club");
    }

    @Test
    void aRatingSavedInOneTabIsNotUndoneByARunTypeSavedInAnother() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        String session = bearer(owner);

        List<Integer> statuses = sendTogether(List.of(
                edit(run, session, "{\"perceivedExertion\":7,\"useRatingForEffort\":true}"),
                edit(run, session, "{\"runType\":\"RACE\",\"name\":\"Club 5K\"}"),
                edit(run, session, "{\"notes\":\"windy\"}")));

        assertThat(statuses).containsExactly(200, 200, 200);
        Activity saved = reload(run);
        assertThat(saved.getPerceivedExertion()).isEqualTo(7);
        assertThat(saved.isUseRatingForEffort()).isTrue();
        assertThat(saved.getRunType()).isEqualTo("RACE");
        assertThat(saved.getName()).isEqualTo("Club 5K");
        assertThat(saved.getNotes()).isEqualTo("windy");
    }

    @Test
    void twoRequestsThatSetTheSameTagBothSucceedAndTheRunKeepsOneOfTheirSets() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        String session = bearer(owner);

        List<Integer> statuses = sendTogether(List.of(
                edit(run, session, "{\"tags\":[\"hills\",\"track\"]}"),
                edit(run, session, "{\"tags\":[\"Hills\",\"race day\"]}")));

        assertThat(statuses).as("neither request fails on the unique index of the tags").containsExactly(200, 200);
        assertThat(tagsOf(run)).as("one request's whole set, not a mix of the two").isIn(
                List.of("hills", "track"), List.of("Hills", "race day"));
    }

    @Test
    void manyTabsSavingAtOnceAllSucceedAndLeaveOneOfTheTitles() throws Exception {
        Runner owner = runner();
        Activity run = run(owner);
        String session = bearer(owner);

        List<MockHttpServletRequestBuilder> requests = new ArrayList<>();
        for (int tab = 0; tab < 6; tab++) {
            requests.add(edit(run, session, "{\"name\":\"Title " + tab + "\",\"tags\":[\"tab " + tab + "\",\"shared\"]}"));
        }
        List<Integer> statuses = sendTogether(requests);

        assertThat(statuses).containsOnly(200);
        Activity saved = reload(run);
        assertThat(saved.getName()).matches("Title [0-5]");
        List<String> kept = tagsOf(run);
        assertThat(kept).hasSize(2).contains("shared");
        assertThat(kept.get(0)).isEqualTo("tab " + saved.getName().substring("Title ".length()));
    }
}
