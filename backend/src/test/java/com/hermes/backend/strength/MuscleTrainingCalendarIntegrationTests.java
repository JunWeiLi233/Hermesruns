package com.hermes.backend.strength;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.coaching.CoachRunnerState;
import com.hermes.backend.coaching.CoachRunnerStateRepository;
import com.hermes.backend.coaching.CoachScheduledWorkout;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.coaching.CoachWorkoutType;
import com.hermes.backend.coaching.CoachTrainingBlock;
import com.hermes.backend.coaching.CoachTrainingBlockRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:strength-calendar-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
@Execution(ExecutionMode.SAME_THREAD)
class MuscleTrainingCalendarIntegrationTests {
    static final class CalendarClock extends Clock {
        private final AtomicReference<Instant> time = new AtomicReference<>(Instant.parse("2026-10-22T00:30:00Z"));
        void set(Instant instant) { time.set(instant); }
        @Override public ZoneId getZone() { return ZoneId.of("America/New_York"); }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(instant(), zone); }
        @Override public Instant instant() { return time.get(); }
    }

    @TestConfiguration
    static class FixedServerClock {
        @Bean @Primary CalendarClock calendarClock() { return new CalendarClock(); }
    }

    @Autowired private CalendarClock clock;
    @Autowired private MockMvc mvc;
    @Autowired private AuthService auth;
    @Autowired private RunnerRepository runners;
    @Autowired private CoachRunnerStateRepository states;
    @Autowired private CoachScheduledWorkoutRepository schedules;
    @Autowired private MuscleTrainingPreferenceRepository preferences;
    @Autowired private MuscleTrainingCheckInRepository checkIns;
    @Autowired private CoachTrainingBlockRepository blocks;
    @Autowired private ActivityRepository activities;
    @Autowired private MuscleTrainingPlannerService planner;

    @ParameterizedTest
    @CsvSource({
            "2026-10-22T00:30:00Z, UTC, 2026-10-22",
            "2026-10-22T03:30:00Z, America/New_York, 2026-10-21",
            "2026-10-22T04:30:00Z, America/New_York, 2026-10-22",
            "2026-10-22T23:30:00Z, Pacific/Auckland, 2026-10-23",
            "2026-11-02T04:30:00Z, America/New_York, 2026-11-01",
            "2026-11-02T05:30:00Z, America/New_York, 2026-11-02"
    })
    void checkInPlanAndCycleUseTheCoachAccountCalendar(String instant, String accountZone, LocalDate today) throws Exception {
        clock.set(Instant.parse(instant));
        Runner runner = new Runner("strength-calendar-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setTimeZone(accountZone);
        runner = runners.saveAndFlush(runner);
        String authorization = "Bearer " + auth.issueSessionToken(runner);

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastAggregatedAt(LocalDateTime.ofInstant(clock.instant(), clock.getZone()));
        states.saveAndFlush(state);
        CoachTrainingBlock block = new CoachTrainingBlock();
        block.setRunner(runner);
        block.setActive(true);
        block.setRaceDistanceKm(10);
        block.setTargetRaceDate(today.plusDays(7));
        block.setBlockStartedOn(today.minusWeeks(2));
        blocks.saveAndFlush(block);
        for (int offset = 0; offset < 28; offset++) {
            CoachScheduledWorkout row = new CoachScheduledWorkout();
            row.setRunner(runner);
            row.setScheduledDate(today.plusDays(offset));
            row.setWorkoutType(offset == 0 ? CoachWorkoutType.LONG_RUN : CoachWorkoutType.REST);
            row.setPlannedDistanceKm(offset == 0 ? 18d : null);
            schedules.save(row);
        }
        schedules.flush();
        MuscleTrainingCheckIn historical = new MuscleTrainingCheckIn();
        historical.setRunner(runner);
        historical.setTrainingDate(today.minusDays(1));
        historical.setRunType(MuscleTrainingCheckIn.RunType.REST);
        historical.setEntryState(MuscleTrainingCheckIn.EntryState.ACTUAL);
        historical = checkIns.saveAndFlush(historical);
        var originalUpdatedAt = checkIns.findById(historical.getId()).orElseThrow().getUpdatedAt();

        mvc.perform(get("/api/training/muscle/profile").header("Authorization", authorization)).andExpect(status().isOk());
        assertThat(preferences.findByRunner(runner).orElseThrow().getCycleStartDate())
                .isEqualTo(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        mvc.perform(put("/api/training/muscle/today").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"runType\":\"EASY\",\"entryState\":\"PLANNED\",\"distanceKm\":5,\"durationMinutes\":30}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.trainingDate").value(today.toString()));
        mvc.perform(get("/api/training/muscle/plan").header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayCheckIn.trainingDate").value(today.toString()))
                .andExpect(jsonPath("$.weekContext.raceWeek").value(true))
                .andExpect(jsonPath("$.days[0].date").value(today.toString()))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("EASY"))
                .andExpect(jsonPath("$.days[0].run.planSource").value("USER_PLANNED"))
                .andExpect(jsonPath("$.days[1].run.workoutType").value("REST"))
                .andExpect(jsonPath("$.days[1].run.planSource").value("COACH_SCHEDULE"));
        mvc.perform(delete("/api/training/muscle/today").header("Authorization", authorization)).andExpect(status().isNoContent());
        assertThat(checkIns.findByRunnerAndTrainingDate(runner, today)).isEmpty();
        var preserved = checkIns.findById(historical.getId()).orElseThrow();
        assertThat(preserved.getTrainingDate()).isEqualTo(today.minusDays(1));
        assertThat(preserved.getUpdatedAt()).isEqualTo(originalUpdatedAt);
    }

    @Test
    void measuredWindowsRespectUtcFileAndStravaWallTimeAndExcludeFutureRuns() {
        clock.set(Instant.parse("2026-10-22T03:30:00Z"));
        Runner runner = new Runner("strength-windows-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setTimeZone("America/New_York");
        runner = runners.saveAndFlush(runner);
        saveRun(runner, "2026-10-15T01:30:00", false, 4, 190);  // NY October 14: outside seven days.
        saveRun(runner, "2026-10-15T05:30:00", false, 6, 190);  // NY October 15: inside seven days.
        saveRun(runner, "2026-10-15T01:30:00", true, 8, 190);   // Strava October 15 wall time stays October 15.
        saveRun(runner, "2026-10-22T02:30:00", false, 10, 120); // NY October 21: still today, below the 70% HRmax hard-run threshold.
        saveRun(runner, "2026-10-22T05:30:00", false, 16, 190); // NY October 22: future, outside both windows.
        LocalDate today = LocalDate.parse("2026-10-21");
        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = java.util.stream.IntStream.range(0, 7)
                .mapToObj(offset -> new AutomatedCoachService.CoachScheduledWorkoutDto(
                        today.plusDays(offset), "REST", null, null, false, null, null, false)).toList();

        var context = planner.getPlan(runner, null, schedule).weekContext();
        assertThat(context.volumeKm7d()).isEqualTo(24);
        assertThat(context.volumeKm28d()).isEqualTo(28);
        assertThat(context.recentHardRunCount7d()).isEqualTo(2);
    }

    private void saveRun(Runner runner, String start, boolean strava, double km, double heartRate) {
        Activity run = new Activity();
        run.setRunner(runner);
        run.setActivityType(ActivityType.RUN);
        run.setStartTime(LocalDateTime.parse(start));
        run.setStravaApiSourced(strava);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        run.setMovingTimeSeconds(1800);
        run.setAverageHeartRate(heartRate);
        activities.saveAndFlush(run);
    }
}
