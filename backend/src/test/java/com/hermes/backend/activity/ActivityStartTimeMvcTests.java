package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The time of a run in every answer that carries one is the clock on the runner's wall (BUG-003). A run from a file holds UTC,
 * which the runner's time zone moves; a run fetched from the Strava API already holds the runner's clock.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-start-time-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class ActivityStartTimeMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;

    private Runner runner(String timeZone) {
        Runner runner = new Runner("clock-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** A run that starts at the given clock reading, from a file (UTC) or from the Strava API (the runner's own clock). */
    private Activity run(Runner owner, LocalDateTime start, boolean stravaApi) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName(stravaApi ? "strava" : "file");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(stravaApi ? ImportProvider.STRAVA : ImportProvider.GARMIN);
        run.setStravaApiSourced(stravaApi);
        run.setStartTime(start);
        run.setStartDate(start.toString());
        run.setDistanceKm(8.0);
        run.setDistanceMeters(8000.0);
        run.setMovingTimeSeconds(2400);
        run.setDurationSeconds(2400L);
        return activities.saveAndFlush(run);
    }

    @Test
    void theFeedShowsAFileRunAtTheClockOnTheRunnersWallAndAStravaRunAsItIs() throws Exception {
        Runner owner = runner("America/New_York");
        LocalDateTime stored = LocalDateTime.of(2026, 10, 8, 3, 30);
        Activity file = run(owner, stored, false);
        Activity strava = run(owner, stored, true);

        mockMvc.perform(get("/api/activities").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + file.getId() + ")].startTime").value("2026-10-07T23:30:00"))
                .andExpect(jsonPath("$[?(@.id == " + file.getId() + ")].startDate").value("2026-10-07T23:30"))
                .andExpect(jsonPath("$[?(@.id == " + strava.getId() + ")].startTime").value("2026-10-08T03:30:00"))
                .andExpect(jsonPath("$[?(@.id == " + strava.getId() + ")].startDate").value("2026-10-08T03:30"));
    }

    @Test
    void theSingleRunIsShownTheSameWay() throws Exception {
        Runner owner = runner("America/New_York");
        Activity file = run(owner, LocalDateTime.of(2026, 10, 8, 3, 30), false);

        mockMvc.perform(get("/api/activities").param("id", String.valueOf(file.getId())).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startTime").value("2026-10-07T23:30:00"));
    }

    @Test
    void theAnalysisListIsShownTheSameWay() throws Exception {
        Runner owner = runner("America/New_York");
        Activity file = run(owner, LocalDateTime.of(2026, 10, 8, 3, 30), false);
        Activity strava = run(owner, LocalDateTime.of(2026, 10, 8, 3, 30), true);

        mockMvc.perform(get("/api/activities/analysis").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + file.getId() + ")].startTime").value("2026-10-07T23:30:00"))
                .andExpect(jsonPath("$[?(@.id == " + strava.getId() + ")].startTime").value("2026-10-08T03:30:00"));
    }

    @Test
    void theDashboardAndTheTrainingLogAgree() throws Exception {
        Runner owner = runner("America/New_York");
        // Two days ago at 03:30 UTC, so it is inside the weeks the log shows whatever the date; the clock it is shown at is New York's.
        LocalDateTime stored = java.time.LocalDate.now().minusDays(2).atTime(3, 30);
        String shown = stored.atOffset(java.time.ZoneOffset.UTC).atZoneSameInstant(java.time.ZoneId.of("America/New_York"))
                .toLocalDateTime().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        Activity file = run(owner, stored, false);

        mockMvc.perform(get("/api/profile/dashboard").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[?(@.id == " + file.getId() + ")].startTime").value(shown));
        mockMvc.perform(get("/api/training/log").param("weeks", "4").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[*].days[*].runs[?(@.id == " + file.getId() + ")].startTime").value(shown));
    }

    @Test
    void aRunnerWithoutATimeZoneSeesTheStoredClock() throws Exception {
        Runner owner = runner(null);
        Activity file = run(owner, LocalDateTime.of(2026, 10, 8, 3, 30), false);

        mockMvc.perform(get("/api/activities").param("id", String.valueOf(file.getId())).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startTime").value("2026-10-08T03:30:00"))
                .andExpect(jsonPath("$.startDate").value("2026-10-08T03:30"));
    }

    @Test
    void theStoredValueIsNotChangedByReadingIt() throws Exception {
        Runner owner = runner("Australia/Sydney");
        Activity file = run(owner, LocalDateTime.of(2026, 10, 8, 3, 30), false);

        mockMvc.perform(get("/api/activities").header("Authorization", bearer(owner))).andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(activities.findById(file.getId()).orElseThrow().getStartTime())
                .isEqualTo(LocalDateTime.of(2026, 10, 8, 3, 30));
    }
}
