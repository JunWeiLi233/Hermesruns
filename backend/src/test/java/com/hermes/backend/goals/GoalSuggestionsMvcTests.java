package com.hermes.backend.goals;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The suggested goals through the real servlet stack: a session, the runner's own running only, and the goals they have. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:goal-suggestions-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class GoalSuggestionsMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ObjectMapper json;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("suggest-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private void run(Runner owner, LocalDate day, double km) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds((int) (km * 330));
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        activities.saveAndFlush(run);
    }

    /** Three 10 km runs in each of the last eight complete weeks. */
    private void steadyWeeks(Runner owner) {
        LocalDate thisMonday = GoalPeriods.start(GoalPeriods.WEEK, today());
        for (int back = 1; back <= 8; back++) {
            for (int i = 0; i < 3; i++) {
                run(owner, thisMonday.minusWeeks(back).plusDays((today().getDayOfWeek().getValue() - 1 + i * 2) % 7), 10);
            }
        }
    }

    @Test
    void itNeedsASession() throws Exception {
        mockMvc.perform(get("/api/goals/suggestions")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", "Bearer nonsense")).andExpect(status().isUnauthorized());
    }

    @Test
    void aNewRunnerGetsNoSuggestionsAndIsToldThereIsNotEnoughToGoOn() throws Exception {
        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enough").value(false))
                .andExpect(jsonPath("$.suggestions", hasSize(0)));
    }

    @Test
    void theGoalTargetEqualsTheSharedCoachTargetWithoutIndependentGrowth() throws Exception {
        Runner owner = runner();
        steadyWeeks(owner);
        var prescription = json.readTree(mockMvc.perform(get("/api/coach/today").header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enough").value(true))
                .andExpect(jsonPath("$.timeZone").value("Z"))
                .andExpect(jsonPath("$.suggestions[0].period").value("WEEK"))
                .andExpect(jsonPath("$.suggestions[0].metric").value("DISTANCE"))
                .andExpect(jsonPath("$.suggestions[0].target").value(prescription.path("plan").path("targetWeeklyKm").asDouble()))
                .andExpect(jsonPath("$.suggestions[0].unit").value("km"))
                .andExpect(jsonPath("$.suggestions[0].basis.kind").value("coach-plan"))
                .andExpect(jsonPath("$.suggestions[0].basis.span").value(8))
                .andExpect(jsonPath("$.suggestions[0].basis.usual").value(30.0))
                .andExpect(jsonPath("$.suggestions[0].basis.stretchPercent").value(0));
    }

    @Test
    void easierDayPersistsAcrossTodayGoalsAndScheduleAndCanBeReset() throws Exception {
        Runner owner=runner();steadyWeeks(owner);String token=bearer(owner);
        var before=json.readTree(mockMvc.perform(get("/api/coach/today").header("Authorization",token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        double original=before.path("today").path("plannedDistanceKm").asDouble();
        assert original>0;
        var adjusted=json.readTree(mockMvc.perform(post("/api/coach/today/ease").header("Authorization",token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.today.reasonCode").value("manual_ease"))
                .andReturn().getResponse().getContentAsString());
        double distance=adjusted.path("today").path("plannedDistanceKm").asDouble();
        org.assertj.core.api.Assertions.assertThat(distance).isEqualTo(Math.floor(original*0.75*10)/10d);
        mockMvc.perform(get("/api/coach/today").header("Authorization",token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.today.plannedDistanceKm").value(distance));
        mockMvc.perform(get("/api/coach/schedule?days=14").header("Authorization",token)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].plannedDistanceKm").value(distance));
        mockMvc.perform(get("/api/goals/suggestions").header("Authorization",token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions[0].target").value(adjusted.path("plan").path("targetWeeklyKm").asDouble()));
        mockMvc.perform(post("/api/coach/today/ease").header("Authorization",token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.today.plannedDistanceKm").value(original));
    }

    @Test
    void aGoalTheRunnerAlreadyHasIsLeftOutAndSettingASuggestionTakesItOffTheList() throws Exception {
        Runner owner = runner();
        steadyWeeks(owner);

        mockMvc.perform(post("/api/goals").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"period\":\"WEEK\",\"metric\":\"DISTANCE\",\"target\":35}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enough").value(true))
                .andExpect(jsonPath("$.suggestions[?(@.period == 'WEEK' && @.metric == 'DISTANCE')]", hasSize(0)))
                .andExpect(jsonPath("$.suggestions[0].metric").value("COUNT"));
    }

    @Test
    void anotherRunnersRunningIsNeverUsed() throws Exception {
        Runner busy = runner();
        steadyWeeks(busy);
        Runner quiet = runner();

        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(quiet)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enough").value(false))
                .andExpect(jsonPath("$.suggestions", hasSize(0)));
        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(busy)))
                .andExpect(jsonPath("$.suggestions", hasSize(not(0))));
    }

    @Test
    void theWeekIsTheRunnersOwnWhenTheyHaveATimeZone() throws Exception {
        Runner owner = runner();
        owner.setTimeZone("Pacific/Auckland");
        runners.saveAndFlush(owner);
        steadyWeeks(owner);

        mockMvc.perform(get("/api/goals/suggestions").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeZone").value("Pacific/Auckland"));
    }
}
