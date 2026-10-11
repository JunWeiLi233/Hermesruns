package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.activity.RunLabelService;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The training log endpoint through the real servlet stack: security, argument handling, filters, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-log-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class TrainingLogMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private RunLabelService labelService;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("log-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static LocalDate mondayOf(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private Activity run(Runner owner, LocalDate day, int hour, String runType, String... tags) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.of(hour, 0)));
        run.setMovingTimeSeconds(1500);
        run.setDistanceKm(5.0);
        run.setDistanceMeters(5000.0);
        run.setRunType(runType);
        run = activities.saveAndFlush(run);
        if (tags.length > 0) {
            List<String> given = List.of(tags);
            labelService.apply(owner, run, new RunLabelService.Change(false, null, true, given), RunLabelService.cleanTags(given));
        }
        return run;
    }

    @Test
    void aRunnerReadsTheirRunsByWeekAndDay() throws Exception {
        Runner owner = runner();
        Activity race = run(owner, today(), 7, "RACE", "5k", "Hills");

        mockMvc.perform(get("/api/training/log").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(today().toString()))
                .andExpect(jsonPath("$.weeks", hasSize(12)))
                .andExpect(jsonPath("$.weeks[0].start").value(mondayOf(today()).toString()))
                .andExpect(jsonPath("$.weeks[0].end").value(mondayOf(today()).plusDays(6).toString()))
                .andExpect(jsonPath("$.weeks[0].runs").value(1))
                .andExpect(jsonPath("$.weeks[0].distanceKm").value(5.0))
                .andExpect(jsonPath("$.weeks[0].movingSeconds").value(1500))
                .andExpect(jsonPath("$.weeks[0].days", hasSize(1)))
                .andExpect(jsonPath("$.weeks[0].days[0].date").value(today().toString()))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].id").value(race.getId()))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].name").value(race.getName()))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].runType").value("RACE"))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].tags", contains("5k", "Hills")))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].paceSecPerKm").value(300.0))
                .andExpect(jsonPath("$.weeks[1].runs").value(0))
                .andExpect(jsonPath("$.weeks[1].days", hasSize(0)))
                .andExpect(jsonPath("$.olderRuns").value(false))
                .andExpect(jsonPath("$.runTypes", contains("RACE")))
                .andExpect(jsonPath("$.tags[0].tag").value("5k"))
                .andExpect(jsonPath("$.tags[0].runs").value(1));
    }

    @Test
    void theNumberOfWeeksAndTheDayTheyEndOnCanBeAsked() throws Exception {
        Runner owner = runner();
        LocalDate fourWeeksAgo = today().minusWeeks(4);
        Activity old = run(owner, fourWeeksAgo, 7, null);
        run(owner, today(), 7, null);

        mockMvc.perform(get("/api/training/log").param("weeks", "1").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(1)))
                .andExpect(jsonPath("$.olderRuns").value(true));
        mockMvc.perform(get("/api/training/log").param("weeks", "26").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(26)))
                .andExpect(jsonPath("$.olderRuns").value(false));
        mockMvc.perform(get("/api/training/log").param("to", fourWeeksAgo.toString()).param("weeks", "1")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(1)))
                .andExpect(jsonPath("$.weeks[0].start").value(mondayOf(fourWeeksAgo).toString()))
                .andExpect(jsonPath("$.weeks[0].days[0].runs[0].id").value(old.getId()))
                .andExpect(jsonPath("$.to").value(mondayOf(fourWeeksAgo).plusDays(6).toString()))
                .andExpect(jsonPath("$.today").value(today().toString()));
    }

    @Test
    void theFiltersArePassedOnAndRepeatedTagsAreAllRequired() throws Exception {
        Runner owner = runner();
        Activity both = run(owner, today(), 6, "WORKOUT", "Hills", "Track");
        Activity hills = run(owner, today(), 7, "RACE", "hills");
        run(owner, today(), 8, "WORKOUT");

        mockMvc.perform(get("/api/training/log").param("runType", "WORKOUT").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].runs").value(2));
        mockMvc.perform(get("/api/training/log").param("tag", "HILLS").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].days[0].runs[*].id", contains(both.getId().intValue(), hills.getId().intValue())));
        mockMvc.perform(get("/api/training/log").param("tag", "hills").param("tag", "track").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].days[0].runs[*].id", contains(both.getId().intValue())));
        mockMvc.perform(get("/api/training/log").param("runType", "RACE").param("tag", "track").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].runs").value(0));
        mockMvc.perform(get("/api/training/log").param("runType", " ").param("tag", "").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].runs").value(3));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"weeks=0", "weeks=27", "weeks=-3", "weeks=many", "weeks=2.5", "to=yesterday", "to=2026-13-45",
            "to=10/10/2026", "runType=ULTRA", "runType=race"})
    void aRequestThatMakesNoSenseIsRefusedInPlainWords(String query) throws Exception {
        Runner owner = runner();
        String[] pair = query.split("=", 2);

        mockMvc.perform(get("/api/training/log").param(pair[0], pair[1]).header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_LOG_REQUEST"))
                .andExpect(jsonPath("$.error").isString());
    }

    @Test
    void theLogNeedsASession() throws Exception {
        mockMvc.perform(get("/api/training/log")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/training/log").header("Authorization", "Bearer not-a-token")).andExpect(status().isUnauthorized());
    }

    @Test
    void anotherRunnersRunsAndTagsNeverAppear() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        run(owner, today(), 7, null, "mine");
        run(stranger, today(), 8, "RACE", "secret plan");

        mockMvc.perform(get("/api/training/log").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].runs").value(1))
                .andExpect(jsonPath("$.runTypes", hasSize(0)))
                .andExpect(jsonPath("$.tags", hasSize(1)))
                .andExpect(jsonPath("$.tags[0].tag").value("mine"));
        mockMvc.perform(get("/api/training/log").param("tag", "secret plan").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0].runs").value(0));
    }
}
