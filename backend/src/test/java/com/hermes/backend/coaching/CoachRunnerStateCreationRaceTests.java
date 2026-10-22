package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A new runner's first visit to Home asks for the coach state and the muscle plan at the same moment, and each creates the runner's
 * state row when there is none. The loser of that race hit the unique index, the Hibernate session of its request was left broken
 * ("null id in entry") and the request answered 500 (BUG-012). Both requests must get the one row that exists.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:coach-state-race;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class CoachRunnerStateCreationRaceTests {

    private static final CyclicBarrier BOTH_HAVE_ARRIVED = new CyclicBarrier(2);
    private static final ThreadLocal<Boolean> HAS_ARRIVED = ThreadLocal.withInitial(() -> false);
    private static volatile boolean holdBeforeTheLock;

    /**
     * Both requests reach first-use initialization together. Hold them before the real database lock, so the regression
     * exercises transaction serialization without requiring the second request to read state before it owns the runner.
     */
    @TestConfiguration
    static class HoldRequestsBeforeTheLock {
        @Bean
        static BeanPostProcessor holdRequestsAtFirstUse() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    if (!(bean instanceof RunnerRepository)) return bean;
                    return Proxy.newProxyInstance(RunnerRepository.class.getClassLoader(),
                            new Class<?>[] {RunnerRepository.class}, (proxy, method, args) -> {
                                if (holdBeforeTheLock && "findByIdForUpdate".equals(method.getName()) && !HAS_ARRIVED.get()) {
                                    HAS_ARRIVED.set(true);
                                    BOTH_HAVE_ARRIVED.await(10, TimeUnit.SECONDS);
                                }
                                Object answer;
                                try {
                                    answer = method.invoke(bean, args);
                                } catch (InvocationTargetException failure) {
                                    throw failure.getCause();
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

    @Test
    void twoRequestsThatBothFindNoStateEndUpWithTheSameOneRow() throws Exception {
        Runner runner = runners.saveAndFlush(new Runner("race-" + UUID.randomUUID() + "@hermes.test", "active"));

        holdBeforeTheLock = true;
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Object>> requests = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                Callable<Object> request = () -> coach.getCoachState(runner);
                requests.add(pool.submit(request));
            }
            for (Future<Object> request : requests) {
                assertThat(request.get(30, TimeUnit.SECONDS)).as("a coach state, not an exception").isNotNull();
            }
        } finally {
            holdBeforeTheLock = false;
            pool.shutdownNow();
        }

        long rows = states.findAll().stream().filter((state) -> state.getRunner().getId().equals(runner.getId())).count();
        assertThat(rows).isEqualTo(1);
    }
}
