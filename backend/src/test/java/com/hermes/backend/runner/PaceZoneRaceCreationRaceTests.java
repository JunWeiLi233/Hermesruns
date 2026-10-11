package com.hermes.backend.runner;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A runner's first race can be entered twice at the same moment (a double click, two tabs). Both requests look for the runner's
 * race, find none, and used to both insert one: the loser hit the unique index and the request failed. Now the requests take turns
 * on the runner's row, so the second one finds the first one's race and replaces it, and neither fails.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pace-zone-race-creation;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class PaceZoneRaceCreationRaceTests {

    private static final CyclicBarrier BOTH_HAVE_LOOKED = new CyclicBarrier(2);
    private static final ThreadLocal<Boolean> HAS_LOOKED = ThreadLocal.withInitial(() -> false);
    private static volatile boolean holdAfterTheLookup;
    /** Long enough for the other request to arrive if it can, short enough that a request kept out by the runner's row goes on. */
    private static final long HOLD_MILLIS = 700;

    /**
     * Puts the repository behind a wrapper that holds a request, once its lookup has found no race, until the other request has
     * looked as well. Without the runner's row between them both then insert one, which is the order that used to break. With it
     * the other request cannot look yet, so the hold ends on its own and the first one carries on.
     */
    @TestConfiguration
    static class HoldRequestsAfterTheLookup {
        @Bean
        static BeanPostProcessor holdRequestsThatFoundNoRace() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    if (!(bean instanceof RunnerPaceZoneRaceRepository)) return bean;
                    return Proxy.newProxyInstance(RunnerPaceZoneRaceRepository.class.getClassLoader(),
                            new Class<?>[] {RunnerPaceZoneRaceRepository.class}, (proxy, method, args) -> {
                                Object answer;
                                try {
                                    answer = method.invoke(bean, args);
                                } catch (InvocationTargetException failure) {
                                    throw failure.getCause();
                                }
                                if (holdAfterTheLookup && "findByRunner".equals(method.getName()) && !HAS_LOOKED.get()
                                        && answer instanceof Optional<?> found && found.isEmpty()) {
                                    HAS_LOOKED.set(true);
                                    try {
                                        BOTH_HAVE_LOOKED.await(HOLD_MILLIS, TimeUnit.MILLISECONDS);
                                    } catch (TimeoutException | BrokenBarrierException ended) {
                                        // The other request is waiting for the runner's row: this one goes on.
                                    }
                                }
                                return answer;
                            });
                }
            };
        }
    }

    @Autowired private PaceZoneRaceService service;
    @Autowired private RunnerRepository runners;
    @Autowired private RunnerPaceZoneRaceRepository rows;

    @Test
    void twoFirstRequestsThatBothFindNoRaceEndUpWithOneRaceAndNeitherFails() throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("race-" + UUID.randomUUID() + "@hermes.test", "active"));
        LocalDate day = LocalDate.now(ZoneOffset.UTC).minusDays(3);

        BOTH_HAVE_LOOKED.reset();
        holdAfterTheLookup = true;
        ExecutorService pool = Executors.newFixedThreadPool(2, (task) -> new Thread(task, "pace-zone-race-request"));
        try {
            List<Future<PaceZoneRaceService.Race>> requests = new ArrayList<>();
            for (int seconds : new int[] {2700, 2640}) {
                Callable<PaceZoneRaceService.Race> request = () -> {
                    HAS_LOOKED.set(false);
                    return service.set(runner, 10000, seconds, day);
                };
                requests.add(pool.submit(request));
            }
            for (Future<PaceZoneRaceService.Race> request : requests) {
                assertThat(request.get(60, TimeUnit.SECONDS)).as("a race, not an exception").isNotNull();
            }
        } finally {
            holdAfterTheLookup = false;
            pool.shutdownNow();
        }

        List<RunnerPaceZoneRace> theirs = rows.findAll().stream().filter((row) -> row.getRunner().getId().equals(runner.getId())).toList();
        assertThat(theirs).hasSize(1);
        assertThat(theirs.get(0).getTimeSeconds()).isIn(2700, 2640);
        assertThat(theirs.get(0).getRaceDate()).isEqualTo(day);
    }

    @Test
    void manyRequestsAtOnceFromOneRunnerAllSucceedAndLeaveOneRace() throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("race-" + UUID.randomUUID() + "@hermes.test", "active"));
        LocalDate day = LocalDate.now(ZoneOffset.UTC).minusDays(3);

        holdAfterTheLookup = false;
        int requestsAtOnce = 8;
        CyclicBarrier go = new CyclicBarrier(requestsAtOnce);
        ExecutorService pool = Executors.newFixedThreadPool(requestsAtOnce);
        try {
            List<Future<PaceZoneRaceService.Race>> requests = new ArrayList<>();
            for (int index = 0; index < requestsAtOnce; index++) {
                int seconds = 2700 + index;
                requests.add(pool.submit(() -> {
                    go.await(30, TimeUnit.SECONDS);
                    return service.set(runner, 10000, seconds, day);
                }));
            }
            for (Future<PaceZoneRaceService.Race> request : requests) {
                assertThat(request.get(60, TimeUnit.SECONDS)).isNotNull();
            }
        } finally {
            pool.shutdownNow();
        }

        List<RunnerPaceZoneRace> theirs = rows.findAll().stream().filter((row) -> row.getRunner().getId().equals(runner.getId())).toList();
        assertThat(theirs).hasSize(1);
        assertThat(theirs.get(0).getTimeSeconds()).isBetween(2700, 2707);
    }
}
