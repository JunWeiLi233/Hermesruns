package com.hermes.backend.runtime;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class SleepWakeCatchUpTests {
    @Test
    void queuesOneAsynchronousPassAndDoesNotRepeatOnDuplicateReadinessEvents() {
        List<Runnable> queue = new ArrayList<>();
        AtomicInteger runs = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(queue::add,
                runs::incrementAndGet, runs::incrementAndGet, runs::incrementAndGet);

        catchUp.afterStartup();
        catchUp.afterStartup();

        assertThat(queue).hasSize(1);
        assertThat(runs).hasValue(0);
        queue.get(0).run();
        assertThat(runs).hasValue(3);
        catchUp.afterStartup();
        assertThat(queue).hasSize(1);
    }

    @Test
    void failedIntegrationDoesNotPreventOtherCatchUpsOrRetryForever() {
        AtomicInteger garminRuns = new AtomicInteger();
        AtomicInteger coachRuns = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(Runnable::run,
                () -> { throw new IllegalStateException("test provider unavailable"); },
                garminRuns::incrementAndGet, coachRuns::incrementAndGet);

        catchUp.afterStartup();
        catchUp.afterStartup();

        assertThat(garminRuns).hasValue(1);
        assertThat(coachRuns).hasValue(1);
    }
}
