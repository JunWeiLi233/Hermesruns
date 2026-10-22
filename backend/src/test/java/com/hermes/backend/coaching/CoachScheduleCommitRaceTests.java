package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** A method-level monitor must not let the next planner read an uncommitted schedule. */
@SpringBootTest(properties = {
        "spring.datasource.url=${HERMES_COACH_COMMIT_TEST_JDBC_URL:jdbc:h2:mem:coach-schedule-commit-race;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE}",
        "spring.datasource.driver-class-name=${HERMES_COACH_COMMIT_TEST_JDBC_DRIVER:org.h2.Driver}",
        "spring.datasource.username=${HERMES_COACH_COMMIT_TEST_JDBC_USER:sa}",
        "spring.datasource.password=${HERMES_COACH_COMMIT_TEST_JDBC_PASSWORD:}",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class CoachScheduleCommitRaceTests {
    private static volatile Probe activeProbe;

    private static final class Probe {
        volatile Thread secondRequest;
        final CountDownLatch secondReachedDatabase = new CountDownLatch(1);
        final CountDownLatch secondReadSchedule = new CountDownLatch(1);
    }

    @TestConfiguration
    static class ObserveRequestProgress {
        @Bean
        static BeanPostProcessor observeRealRepositories() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    Class<?> repository = bean instanceof RunnerRepository ? RunnerRepository.class
                            : bean instanceof CoachRunnerStateRepository ? CoachRunnerStateRepository.class
                            : bean instanceof CoachScheduledWorkoutRepository ? CoachScheduledWorkoutRepository.class : null;
                    if (repository == null) return bean;
                    return Proxy.newProxyInstance(repository.getClassLoader(), new Class<?>[]{repository}, (proxy, method, args) -> {
                        Probe probe = activeProbe;
                        boolean second = probe != null && probe.secondRequest == Thread.currentThread();
                        if (second) probe.secondReachedDatabase.countDown();
                        Object answer;
                        try { answer = method.invoke(bean, args); }
                        catch (InvocationTargetException failure) { throw failure.getCause(); }
                        if (second && method.getName().equals("findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc")) {
                            probe.secondReadSchedule.countDown();
                        }
                        return answer;
                    });
                }
            };
        }
    }

    @Autowired private AutomatedCoachService coach;
    @Autowired private RunnerRepository runners;
    @Autowired private CoachRunnerStateRepository states;
    @Autowired private CoachScheduledWorkoutRepository workouts;
    @Autowired private PlatformTransactionManager transactions;

    @ParameterizedTest
    @ValueSource(strings = {"schedule", "state", "today"})
    void aSecondPlannerRequestWaitsForTheFirstTransactionToCommit(String endpoint) throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("schedule-commit-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        // State can already exist after a preserving-state read, while no schedule has been generated yet.
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastAggregatedAt(LocalDateTime.now());
        states.saveAndFlush(state);

        var firstReturned = new CountDownLatch(1);
        var allowFirstCommit = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        Probe probe = new Probe();
        activeProbe = probe;
        try {
            var first = pool.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                var schedule = coach.getSchedule(runner, 14);
                firstReturned.countDown();
                try {
                    if (!allowFirstCommit.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("First commit was not released");
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(interrupted);
                }
                return schedule;
            }));
            assertThat(firstReturned.await(10, TimeUnit.SECONDS)).isTrue();
            var second = pool.submit(() -> {
                probe.secondRequest = Thread.currentThread();
                return switch (endpoint) {
                    case "state" -> coach.getCoachState(runner);
                    case "today" -> coach.getTodayWithReadiness(runner, false);
                    default -> coach.getSchedule(runner, 14);
                };
            });
            assertThat(probe.secondReachedDatabase.await(10, TimeUnit.SECONDS)).isTrue();
            // Before the fix this returns immediately: the Java monitor was released, but the inserts were not committed.
            // With transaction-lifetime serialization the second request is waiting before it can read those dates.
            probe.secondReadSchedule.await(1, TimeUnit.SECONDS);
            assertThat(second.isDone()).as("the first transaction still owns schedule initialization").isFalse();
            allowFirstCommit.countDown();
            var firstSchedule = first.get(15, TimeUnit.SECONDS);
            assertThat(firstSchedule).hasSize(14);
            assertThat(second.get(15, TimeUnit.SECONDS)).as("every planner endpoint remains usable").isNotNull();

            LocalDate start = firstSchedule.get(0).scheduledDate();
            var saved = workouts.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(
                    runner, start, start.plusDays(13));
            assertThat(saved).hasSize(14).extracting(CoachScheduledWorkout::getScheduledDate).doesNotHaveDuplicates();
            assertThat(coach.getTodayWithReadiness(runner, false).today().reasonCode()).isEqualTo("history_required");
        } finally {
            allowFirstCommit.countDown();
            activeProbe = null;
            pool.shutdownNow();
        }
    }
}
