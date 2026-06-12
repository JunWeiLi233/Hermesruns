package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class WeeklyDigestServiceTests {

    @Test
    void serviceRuntimeConstructorIsExplicitlyAutowired() throws NoSuchMethodException {
        Constructor<WeeklyDigestService> constructor = WeeklyDigestService.class.getConstructor(
                ActivityRepository.class,
                ReadinessService.class
        );

        assertThat(constructor.getAnnotation(Autowired.class)).isNotNull();
    }

    @Test
    void buildDigestReturnsPreviousWeekSummaryVdotWellnessAndFocus() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        Runner runner = runner();
        Clock clock = Clock.fixed(Instant.parse("2026-05-11T12:00:00Z"), ZoneOffset.UTC);
        WeeklyDigestService service = new WeeklyDigestService(activityRepository, readinessService);
        service.setClockForTests(clock);

        LocalDate weekStart = LocalDate.parse("2026-05-04");
        LocalDate currentWeekStart = LocalDate.parse("2026-05-11");
        LocalDate priorWeekStart = LocalDate.parse("2026-04-27");

        when(activityRepository.findRunsBetween(
                eq(runner),
                eq(ActivityType.RUN),
                eq(weekStart.atStartOfDay()),
                eq(currentWeekStart.atStartOfDay())
        )).thenReturn(List.of(
                run(runner, "Tempo 5K", "2026-05-06T07:00:00", 5.0, 1500),
                run(runner, "Long aerobic", "2026-05-10T08:30:00", 8.0, 2520)
        ));
        when(activityRepository.findRunsBetween(
                eq(runner),
                eq(ActivityType.RUN),
                eq(priorWeekStart.atStartOfDay()),
                eq(weekStart.atStartOfDay())
        )).thenReturn(List.of(
                run(runner, "Prior 5K", "2026-04-30T07:00:00", 5.0, 1650),
                run(runner, "Prior aerobic", "2026-05-03T08:30:00", 8.0, 2720)
        ));
        when(readinessService.getDailyReadiness(eq(runner), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    LocalDate date = invocation.getArgument(1);
                    int score = !date.isBefore(weekStart) && date.isBefore(currentWeekStart) ? 82 : 72;
                    return new ReadinessService.ReadinessDay(date, score);
                });

        WeeklyDigestService.WeeklyDigestResponse digest = service.buildDigest(runner);

        assertThat(digest.weekStart()).isEqualTo(weekStart);
        assertThat(digest.weekEnd()).isEqualTo(LocalDate.parse("2026-05-10"));
        assertThat(digest.trainingSummary().runCount()).isEqualTo(2);
        assertThat(digest.trainingSummary().totalDistanceKm()).isEqualTo(13.0);
        assertThat(digest.trainingSummary().totalDurationSeconds()).isEqualTo(4020);
        assertThat(digest.trainingSummary().longRunKm()).isEqualTo(8.0);
        assertThat(digest.trainingSummary().averagePaceSecPerKm()).isEqualTo(309.2);
        assertThat(digest.vdot().hasData()).isTrue();
        assertThat(digest.vdot().delta()).isGreaterThan(0.8);
        assertThat(digest.vdot().direction()).isEqualTo("improving");
        assertThat(digest.wellnessTrend().hasData()).isTrue();
        assertThat(digest.wellnessTrend().delta()).isEqualTo(10.0);
        assertThat(digest.wellnessTrend().direction()).isEqualTo("improving");
        assertThat(digest.coachFocus().key()).isEqualTo("build_consistency");
    }

    @Test
    void buildDigestUsesRecoveryFocusWhenWellnessDeclines() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        Runner runner = runner();
        Clock clock = Clock.fixed(Instant.parse("2026-05-11T12:00:00Z"), ZoneOffset.UTC);
        WeeklyDigestService service = new WeeklyDigestService(activityRepository, readinessService);
        service.setClockForTests(clock);

        LocalDate weekStart = LocalDate.parse("2026-05-04");
        LocalDate currentWeekStart = LocalDate.parse("2026-05-11");
        LocalDate priorWeekStart = LocalDate.parse("2026-04-27");

        when(activityRepository.findRunsBetween(eq(runner), eq(ActivityType.RUN), eq(weekStart.atStartOfDay()), eq(currentWeekStart.atStartOfDay())))
                .thenReturn(List.of(
                        run(runner, "Easy one", "2026-05-05T07:00:00", 5.0, 1800),
                        run(runner, "Easy two", "2026-05-07T07:00:00", 5.0, 1780),
                        run(runner, "Easy three", "2026-05-10T07:00:00", 5.0, 1760)
                ));
        when(activityRepository.findRunsBetween(eq(runner), eq(ActivityType.RUN), eq(priorWeekStart.atStartOfDay()), eq(weekStart.atStartOfDay())))
                .thenReturn(List.of(run(runner, "Prior", "2026-04-29T07:00:00", 5.0, 1760)));
        when(readinessService.getDailyReadiness(eq(runner), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    LocalDate date = invocation.getArgument(1);
                    int score = !date.isBefore(weekStart) && date.isBefore(currentWeekStart) ? 61 : 78;
                    return new ReadinessService.ReadinessDay(date, score);
                });

        WeeklyDigestService.WeeklyDigestResponse digest = service.buildDigest(runner);

        assertThat(digest.wellnessTrend().direction()).isEqualTo("declining");
        assertThat(digest.coachFocus().key()).isEqualTo("protect_recovery");
    }

    @Test
    void buildDigestDoesNotPublishWellnessTrendFromFallbackOnlyReadiness() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        Runner runner = runner();
        Clock clock = Clock.fixed(Instant.parse("2026-05-11T12:00:00Z"), ZoneOffset.UTC);
        WeeklyDigestService service = new WeeklyDigestService(activityRepository, readinessService);
        service.setClockForTests(clock);

        LocalDate weekStart = LocalDate.parse("2026-05-04");
        LocalDate currentWeekStart = LocalDate.parse("2026-05-11");
        LocalDate priorWeekStart = LocalDate.parse("2026-04-27");

        when(activityRepository.findRunsBetween(eq(runner), eq(ActivityType.RUN), eq(weekStart.atStartOfDay()), eq(currentWeekStart.atStartOfDay())))
                .thenReturn(List.of(run(runner, "Easy", "2026-05-05T07:00:00", 5.0, 1800)));
        when(activityRepository.findRunsBetween(eq(runner), eq(ActivityType.RUN), eq(priorWeekStart.atStartOfDay()), eq(weekStart.atStartOfDay())))
                .thenReturn(List.of(run(runner, "Prior", "2026-04-29T07:00:00", 5.0, 1800)));
        when(readinessService.getDailyReadiness(eq(runner), any(LocalDate.class)))
                .thenAnswer(invocation -> new ReadinessService.ReadinessDay(invocation.getArgument(1), 75, false));

        WeeklyDigestService.WeeklyDigestResponse digest = service.buildDigest(runner);

        assertThat(digest.wellnessTrend().hasData()).isFalse();
        assertThat(digest.wellnessTrend().currentAverage()).isNull();
        assertThat(digest.wellnessTrend().previousAverage()).isNull();
        assertThat(digest.wellnessTrend().delta()).isNull();
        assertThat(digest.wellnessTrend().direction()).isEqualTo("unknown");
    }

    @Test
    void controllerRequiresAuthorization() {
        AuthService authService = mock(AuthService.class);
        WeeklyDigestService weeklyDigestService = mock(WeeklyDigestService.class);
        WeeklyDigestController controller = new WeeklyDigestController(authService, weeklyDigestService);

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getWeeklyDigest(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isEqualTo(Map.of("error", "Invalid or expired session token."));
        verifyNoInteractions(weeklyDigestService);
    }

    @Test
    void controllerReturnsDigestForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        WeeklyDigestService weeklyDigestService = mock(WeeklyDigestService.class);
        WeeklyDigestController controller = new WeeklyDigestController(authService, weeklyDigestService);
        Runner runner = runner();
        WeeklyDigestService.WeeklyDigestResponse payload = new WeeklyDigestService.WeeklyDigestResponse(
                LocalDate.parse("2026-05-04"),
                LocalDate.parse("2026-05-10"),
                new WeeklyDigestService.TrainingSummary(LocalDate.parse("2026-05-04"), LocalDate.parse("2026-05-10"), 0, 0, 0, 0, null),
                new WeeklyDigestService.VdotTrend(null, null, null, "maintaining", false),
                new WeeklyDigestService.WellnessTrend(null, null, null, "unknown", false),
                new WeeklyDigestService.CoachFocus("build_consistency", "Build consistency", "Add one easy run.")
        );
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(weeklyDigestService.buildDigest(runner)).thenReturn(payload);

        ResponseEntity<?> response = controller.getWeeklyDigest("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
        verify(weeklyDigestService).buildDigest(runner);
    }

    private static Runner runner() {
        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    private static Activity run(Runner runner, String name, String startTime, double distanceKm, int movingSeconds) {
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setName(name);
        activity.setStartTime(LocalDateTime.parse(startTime));
        activity.setDistanceKm(distanceKm);
        activity.setMovingTimeSeconds(movingSeconds);
        return activity;
    }
}
