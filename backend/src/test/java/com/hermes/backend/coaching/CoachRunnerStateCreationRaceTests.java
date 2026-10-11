package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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

    private static final CyclicBarrier BOTH_HAVE_LOOKED = new CyclicBarrier(2);
    private static final ThreadLocal<Boolean> HAS_LOOKED = ThreadLocal.withInitial(() -> false);
    private static volatile boolean holdAfterTheLookup;

    /**
     * Puts the repository behind a wrapper that holds a request, once its lookup has found no coach state, until the other request
     * has looked as well. Both then go on to create the row, which is the order that used to break.
     */
    @TestConfiguration
    static class HoldRequestsAfterTheLookup {
        @Bean
        static BeanPostProcessor holdRequestsThatFoundNoCoachState() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    if (!(bean instanceof CoachRunnerStateRepository)) return bean;
                    return Proxy.newProxyInstance(CoachRunnerStateRepository.class.getClassLoader(),
                            new Class<?>[] {CoachRunnerStateRepository.class}, (proxy, method, args) -> {
                                Object answer;
                                try {
                                    answer = method.invoke(bean, args);
                                } catch (InvocationTargetException failure) {
                                    throw failure.getCause();
                                }
                                if (holdAfterTheLookup && "findByRunner".equals(method.getName()) && !HAS_LOOKED.get()
                                        && answer instanceof Optional<?> found && found.isEmpty()) {
                                    HAS_LOOKED.set(true);
                                    BOTH_HAVE_LOOKED.await(10, TimeUnit.SECONDS);
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

        holdAfterTheLookup = true;
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
            holdAfterTheLookup = false;
            pool.shutdownNow();
        }

        long rows = states.findAll().stream().filter((state) -> state.getRunner().getId().equals(runner.getId())).count();
        assertThat(rows).isEqualTo(1);
    }
}
