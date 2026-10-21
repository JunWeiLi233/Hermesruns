package com.hermes.backend.goals;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The goal routes through the real servlet stack: security, ownership, what is refused, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:goals-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class GoalMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private GoalRepository goals;
    @Autowired private AccountDeletionService accountDeletion;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("goals-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private Activity runToday(Runner owner, double km) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(today(), LocalTime.NOON));
        run.setMovingTimeSeconds(1500);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        return activities.saveAndFlush(run);
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Runner as, String body) {
        return request.header("Authorization", bearer(as)).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private long create(Runner owner, String period, String metric, String target) throws Exception {
        mockMvc.perform(json(post("/api/goals"), owner, "{\"period\":\"" + period + "\",\"metric\":\"" + metric + "\",\"target\":" + target + "}"))
                .andExpect(status().isCreated());
        return goals.findByRunnerIdOrderByIdAsc(owner.getId()).stream()
                .filter(goal -> goal.getPeriod().equals(period) && goal.getMetric().equals(metric)).findFirst().orElseThrow().getId();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {"list|GET", "create|POST", "change|PUT", "delete|DELETE"})
    void everyRouteNeedsASession(String name, String method) throws Exception {
        MockHttpServletRequestBuilder request = switch (method) {
            case "GET" -> get("/api/goals");
            case "POST" -> post("/api/goals").contentType(MediaType.APPLICATION_JSON).content("{}");
            case "PUT" -> put("/api/goals/1").contentType(MediaType.APPLICATION_JSON).content("{\"target\":5}");
            default -> delete("/api/goals/1");
        };

        mockMvc.perform(request).andExpect(status().isUnauthorized());
        mockMvc.perform(request.header("Authorization", "Bearer nonsense")).andExpect(status().isUnauthorized());
    }

    @Test
    void aRunnerWithNoGoalsGetsAnEmptyListAndTheChoices() throws Exception {
        mockMvc.perform(get("/api/goals").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals", hasSize(0)))
                .andExpect(jsonPath("$.today").value(today().toString()))
                .andExpect(jsonPath("$.timeZone").value("Z"))
                .andExpect(jsonPath("$.periods", contains("WEEK", "MONTH", "YEAR")))
                .andExpect(jsonPath("$.metrics", contains("DISTANCE", "TIME", "COUNT", "ELEVATION")))
                .andExpect(jsonPath("$.maxTarget.DISTANCE").value(100000.0))
                .andExpect(jsonPath("$.maxTarget.COUNT").value(10000.0));
    }

    @Test
    void aGoalIsSetAndComesBackWithHowFarAlongItIs() throws Exception {
        Runner owner = runner();
        runToday(owner, 5);

        mockMvc.perform(json(post("/api/goals"), owner, "{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":20}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goals", hasSize(1)))
                .andExpect(jsonPath("$.goals[0].id").isNumber())
                .andExpect(jsonPath("$.goals[0].period").value("WEEK"))
                .andExpect(jsonPath("$.goals[0].metric").value("DISTANCE"))
                .andExpect(jsonPath("$.goals[0].unit").value("km"))
                .andExpect(jsonPath("$.goals[0].target").value(20.0))
                .andExpect(jsonPath("$.goals[0].progress").value(5.0))
                .andExpect(jsonPath("$.goals[0].remaining").value(15.0))
                .andExpect(jsonPath("$.goals[0].percent").value(25))
                .andExpect(jsonPath("$.goals[0].reached").value(false))
                .andExpect(jsonPath("$.goals[0].daysTotal").value(7))
                .andExpect(jsonPath("$.goals[0].previous.progress").value(0.0))
                .andExpect(jsonPath("$.goals[0].previous.reached").value(false))
                .andExpect(jsonPath("$.goals[0].thisRun").doesNotExist())
                .andExpect(jsonPath("$.goals[0].status").isString());

        mockMvc.perform(get("/api/goals").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals", hasSize(1)));
    }

    @Test
    void aRunNamedInTheRequestSaysWhatItAdds() throws Exception {
        Runner owner = runner();
        Activity run = runToday(owner, 7.5);
        create(owner, "WEEK", "DISTANCE", "40");
        create(owner, "YEAR", "COUNT", "100");

        mockMvc.perform(get("/api/goals").param("runId", String.valueOf(run.getId())).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals[0].thisRun").value(7.5))
                .andExpect(jsonPath("$.goals[1].thisRun").value(1.0));
        mockMvc.perform(get("/api/goals").param("runId", "999999999").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals[0].thisRun").doesNotExist());
    }

    @Test
    void aRunOfAnotherRunnerNamedInTheRequestAddsNothing() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        runToday(owner, 4);
        Activity theirs = runToday(stranger, 9);
        create(owner, "WEEK", "DISTANCE", "40");

        mockMvc.perform(get("/api/goals").param("runId", String.valueOf(theirs.getId())).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals[0].progress").value(4.0))
                .andExpect(jsonPath("$.goals[0].thisRun").doesNotExist());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "no body|",
            "an empty body|{}",
            "a day|{\"period\":\"DAY\",\"metric\":\"DISTANCE\",\"target\":5}",
            "lower case|{\"period\":\"week\",\"metric\":\"DISTANCE\",\"target\":5}",
            "a period that is a number|{\"period\":7,\"metric\":\"DISTANCE\",\"target\":5}",
            "pace|{\"period\":\"WEEK\",\"metric\":\"PACE\",\"target\":5}",
            "no metric|{\"period\":\"WEEK\",\"target\":5}",
            "no target|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\"}",
            "a null target|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":null}",
            "a target in text|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":\"50\"}",
            "a target of zero|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":0}",
            "a negative target|{\"period\":\"WEEK\",\"metric\":\"COUNT\",\"target\":-2}",
            "a target that rounds to nothing|{\"period\":\"WEEK\",\"metric\":\"COUNT\",\"target\":0.2}",
            "a target too big|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":1000000}",
            "a target in a list|{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":[5]}"
    })
    void aRequestThatIsNotAGoalIsRefusedInPlainWordsAndSavesNothing(String name, String body) throws Exception {
        Runner owner = runner();

        mockMvc.perform(json(post("/api/goals"), owner, body == null ? "" : body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_GOAL"))
                .andExpect(jsonPath("$.error").isString());
        assertThat(goals.findByRunnerIdOrderByIdAsc(owner.getId())).isEmpty();
    }

    @Test
    void aSecondGoalForTheSamePeriodAndMetricIsRefusedWithAWayOut() throws Exception {
        Runner owner = runner();
        create(owner, "MONTH", "DISTANCE", "120");

        mockMvc.perform(json(post("/api/goals"), owner, "{\"period\":\"MONTH\",\"metric\":\"DISTANCE\",\"target\":150}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_GOAL"))
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Change its target")));
        mockMvc.perform(get("/api/goals").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.goals", hasSize(1)))
                .andExpect(jsonPath("$.goals[0].target").value(120.0));
    }

    @Test
    void aTargetIsChangedAndTheWholeListComesBack() throws Exception {
        Runner owner = runner();
        long weekly = create(owner, "WEEK", "DISTANCE", "40");
        create(owner, "YEAR", "DISTANCE", "1000");

        mockMvc.perform(json(put("/api/goals/{id}", weekly), owner, "{\"target\":33.456}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals", hasSize(2)))
                .andExpect(jsonPath("$.goals[0].id").value(weekly))
                .andExpect(jsonPath("$.goals[0].target").value(33.46))
                .andExpect(jsonPath("$.goals[1].target").value(1000.0));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"{}", "{\"target\":0}", "{\"target\":\"9\"}", "{\"target\":null}", "{\"target\":-4}", "{\"target\":999999999}", "{\"metric\":\"COUNT\"}"})
    void aTargetThatIsRefusedLeavesTheOldOne(String body) throws Exception {
        Runner owner = runner();
        long id = create(owner, "WEEK", "COUNT", "4");

        mockMvc.perform(json(put("/api/goals/{id}", id), owner, body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_GOAL"));
        assertThat(goals.findById(id).orElseThrow().getTarget()).isEqualTo(4.0);
        assertThat(goals.findById(id).orElseThrow().getMetric()).isEqualTo("COUNT");
    }

    @Test
    void aGoalIsDeletedAndTheRestComeBack() throws Exception {
        Runner owner = runner();
        long weekly = create(owner, "WEEK", "DISTANCE", "40");
        create(owner, "YEAR", "DISTANCE", "1000");

        mockMvc.perform(delete("/api/goals/{id}", weekly).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goals", hasSize(1)))
                .andExpect(jsonPath("$.goals[0].period").value("YEAR"));
        assertThat(goals.findById(weekly)).isEmpty();
    }

    @Test
    void aGoalThatIsNotTheCallersIsAnsweredLikeOneThatIsNotThere() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        long id = create(owner, "WEEK", "DISTANCE", "40");

        mockMvc.perform(json(put("/api/goals/{id}", id), stranger, "{\"target\":5}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(delete("/api/goals/{id}", id).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(json(put("/api/goals/{id}", 987654321L), owner, "{\"target\":5}")).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/goals/{id}", 987654321L).header("Authorization", bearer(owner))).andExpect(status().isNotFound());

        assertThat(goals.findById(id).orElseThrow().getTarget()).isEqualTo(40.0);
        mockMvc.perform(get("/api/goals").header("Authorization", bearer(stranger))).andExpect(jsonPath("$.goals", hasSize(0)));
    }

    @Test
    void deletingTheAccountDeletesTheGoalsAndOnlyThose() throws Exception {
        Runner doomed = runner();
        Runner kept = runner();
        create(doomed, "WEEK", "DISTANCE", "40");
        create(doomed, "YEAR", "COUNT", "100");
        create(kept, "WEEK", "DISTANCE", "10");

        accountDeletion.deleteAccount(doomed.getId());

        assertThat(goals.findByRunnerIdOrderByIdAsc(doomed.getId())).isEmpty();
        assertThat(goals.findByRunnerIdOrderByIdAsc(kept.getId())).hasSize(1);
    }
}
