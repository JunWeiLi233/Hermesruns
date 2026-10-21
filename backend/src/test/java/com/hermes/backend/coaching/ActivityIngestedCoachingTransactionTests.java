package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityIngestedEvent;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.rewards.DigitalCosmeticsService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:coaching-single-connection;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.datasource.hikari.connection-timeout=500",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ActivityIngestedCoachingTransactionTests {
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private CoachRunnerStateRepository states;
    @Autowired private ApplicationEventPublisher events;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private RecommendationSourceRevision sourceRevision;
    @Autowired private AutomatedCoachService coach;
    @Autowired private ReadinessService readiness;
    @Autowired private com.hermes.backend.imports.AppleHealthImportService apple;
    // Exercise only the real coaching listener; other ingestion consumers have their own coverage.
    @MockitoBean private TrainingMetricsService trainingMetrics;
    @MockitoBean private DigitalCosmeticsService cosmetics;

    @Test
    void ingestionPersistsCoachingWithoutBorrowingASecondConnection() {
        Runner runner = runners.saveAndFlush(new Runner("one-connection-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        Long activityId = new TransactionTemplate(transactions).execute(status -> {
            Activity run = new Activity();
            run.setRunner(runner);
            run.setActivityType(ActivityType.RUN);
            run.setStartTime(LocalDateTime.now(ZoneOffset.UTC).minusHours(1));
            run.setDistanceKm(1.0);
            run.setDistanceMeters(1000.0);
            run.setMovingTimeSeconds(600);
            run = activities.saveAndFlush(run);
            events.publishEvent(new ActivityIngestedEvent(runner.getId(), run.getId()));
            return run.getId();
        });

        assertThat(activities.findById(activityId)).isPresent();
        var state = states.findByRunner(runner);
        assertThat(state).isPresent();
        assertThat(state.orElseThrow().getVolumeKm7d()).isEqualTo(1.0);
    }

    @Test
    void providerEventsWithoutATransactionStillPersistCoachingAndProcessRewards() {
        Runner runner = runners.saveAndFlush(new Runner("provider-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        Activity run = new Activity();
        run.setRunner(runner);
        run.setActivityType(ActivityType.RUN);
        run.setStartTime(LocalDateTime.now(ZoneOffset.UTC).minusHours(1));
        run.setDistanceKm(1.0);
        run.setDistanceMeters(1000.0);
        run.setMovingTimeSeconds(600);
        run = activities.saveAndFlush(run);

        events.publishEvent(new ActivityIngestedEvent(runner.getId(), run.getId()));

        assertThat(states.findByRunner(runner).orElseThrow().getVolumeKm7d()).isEqualTo(1.0);
        verify(cosmetics).handleActivityIngested(runner.getId(), run.getId());
    }

    @Test
    void aRolledBackIngestionDoesNotLeaveCoachingOrProcessRewards() {
        Runner runner = runners.saveAndFlush(new Runner("rolled-back-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        Long activityId = new TransactionTemplate(transactions).execute(status -> {
            Activity run = new Activity();
            run.setRunner(runner);
            run.setActivityType(ActivityType.RUN);
            run.setStartTime(LocalDateTime.now(ZoneOffset.UTC).minusHours(1));
            run.setDistanceKm(1.0);
            run = activities.saveAndFlush(run);
            events.publishEvent(new ActivityIngestedEvent(runner.getId(), run.getId()));
            status.setRollbackOnly();
            return run.getId();
        });

        assertThat(activities.findById(activityId)).isEmpty();
        assertThat(states.findByRunner(runner)).isEmpty();
        verify(cosmetics, never()).handleActivityIngested(runner.getId(), activityId);
    }

    @Test
    void completedRunAutomaticallyDebitsTheSharedWeekAndRemovesTheDailyRoute() {
        Runner runner = historyRunner();
        String before = sourceRevision.revision(runner);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            Activity run = new Activity();
            run.setRunner(runner); run.setActivityType(ActivityType.RUN);
            run.setStartTime(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(10));
            run.setDistanceKm(35.3); run.setDistanceMeters(35_300.0); run.setMovingTimeSeconds(14_000);
            run = activities.saveAndFlush(run);
            events.publishEvent(new ActivityIngestedEvent(runner.getId(), run.getId()));
        });
        assertThat(sourceRevision.revision(runner)).isNotEqualTo(before);
        var today = coach.getTodayWithReadiness(runner);
        assertThat(today.today().workoutType()).isEqualTo("REST");
        assertThat(today.routeRecommendation()).isNull();
        assertThat(today.plan().weeklyBudgets().get(0).completedKm()).isGreaterThanOrEqualTo(35.3);
        assertThat(today.plan().weeklyBudgets().get(0).remainingAllowanceKm()).isZero();
        var end = java.time.LocalDate.now().with(java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.SUNDAY));
        assertThat(today.schedule().stream().filter(day -> !day.scheduledDate().isAfter(end)))
                .allSatisfy(day -> assertThat(day.workoutType()).isEqualTo("REST"));
    }

    @Test
    void completedAppleRecoveryImportReplansBeforeReportingCompletion() throws Exception {
        Runner runner = historyRunner();
        var before = coach.getTodayWithReadiness(runner);
        String original = sourceRevision.revision(runner);
        assertThat(apple.importWellnessData(runner, java.util.List.of(
                java.util.Map.of("type", "sleep", "date", java.time.LocalDate.now(ZoneOffset.UTC).toString(), "score", 5),
                java.util.Map.of("type", "wellness", "date", java.time.LocalDate.now(ZoneOffset.UTC).toString(), "restingHeartRate", 100),
                java.util.Map.of("type", "hrv", "date", java.time.LocalDate.now(ZoneOffset.UTC).toString(), "hrv", 5),
                java.util.Map.of("type", "stress", "date", java.time.LocalDate.now(ZoneOffset.UTC).toString(), "overallStressLevel", 100)
        ))).isTrue();
        org.junit.jupiter.api.Assertions.assertTimeoutPreemptively(java.time.Duration.ofSeconds(10), () -> {
            while (apple.getStatus(runner.getId()).running()) Thread.sleep(20);
        });
        assertThat(sourceRevision.revision(runner)).isNotEqualTo(original);
        assertThat(states.findByRunner(runner).orElseThrow().getReadinessScore()).isLessThan(before.state().readinessScore());
        // This read must not itself advance the source revision (no generated-row refresh loop).
        String afterImport = sourceRevision.revision(runner);
        var after = coach.getTodayWithReadiness(runner);
        assertThat(after.plan().targetWeeklyKm()).isLessThan(before.plan().targetWeeklyKm());
        assertThat(sourceRevision.revision(runner)).isEqualTo(afterImport);
    }

    @Test
    void revisionsAreAccountScopedAndRolledBackRecoveryNeverReplans() {
        Runner runner = historyRunner();
        Runner other = historyRunner();
        String original = sourceRevision.revision(runner);
        String otherOriginal = sourceRevision.revision(other);
        Integer score = states.findByRunner(runner).orElseThrow().getReadinessScore();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            readiness.recordManualRecovery(runner, java.time.LocalDate.now(), 100, 1, 5, 100);
            events.publishEvent(new RecoveryUpdatedEvent(runner.getId()));
            status.setRollbackOnly();
        });
        assertThat(sourceRevision.revision(runner)).isEqualTo(original);
        assertThat(states.findByRunner(runner).orElseThrow().getReadinessScore()).isEqualTo(score);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            readiness.recordManualRecovery(other, java.time.LocalDate.now(), 100, 1, 5, 100);
            events.publishEvent(new RecoveryUpdatedEvent(other.getId()));
        });
        assertThat(sourceRevision.revision(other)).isNotEqualTo(otherOriginal);
        assertThat(sourceRevision.revision(runner)).isEqualTo(original);
    }

    private Runner historyRunner() {
        Runner runner = new Runner("auto-refresh-" + UUID.randomUUID() + "@hermes.test", "ACTIVE");
        runner.setTimeZone("UTC"); runner.setRestingHeartRateBpm(50); runner.setMaxHeartRateBpm(190);
        runner = runners.saveAndFlush(runner);
        for (int daysAgo = 1; daysAgo <= 27; daysAgo += 2) {
            Activity run = new Activity(); run.setRunner(runner); run.setActivityType(ActivityType.RUN);
            run.setStartTime(LocalDateTime.now(ZoneOffset.UTC).minusDays(daysAgo));
            run.setDistanceKm(5.0); run.setDistanceMeters(5000.0); run.setMovingTimeSeconds(1800);
            activities.saveAndFlush(run);
        }
        coach.getTodayWithReadiness(runner);
        return runner;
    }
}
