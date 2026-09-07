package com.hermes.backend.runtime;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class SleepWakeCatchUpTests {
    @Test
    void queuesOneAsynchronousPassAndDoesNotRepeatOnDuplicateReadinessEvents() {
        List<Runnable> queue = new ArrayList<>();
        AtomicInteger runs = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(queue::add,
                () -> { runs.incrementAndGet(); return true; },
                () -> { runs.incrementAndGet(); return true; }, runs::incrementAndGet);

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
    void failedIntegrationStillRunsTheOtherProviderButDefersCoachWithoutPolling() {
        AtomicInteger garminRuns = new AtomicInteger();
        AtomicInteger coachRuns = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(Runnable::run,
                () -> { throw new IllegalStateException("test provider unavailable"); },
                () -> { garminRuns.incrementAndGet(); return true; }, coachRuns::incrementAndGet);

        catchUp.afterStartup();
        catchUp.afterStartup();

        assertThat(garminRuns).hasValue(1);
        assertThat(coachRuns).hasValue(0);
    }

    @Test
    void configurableDelayRunsBeforeProvidersAndKeepsOneShotSemantics() {
        List<Runnable> queue = new ArrayList<>();
        AtomicLong delayedMs = new AtomicLong(-1L);
        AtomicInteger order = new AtomicInteger();
        AtomicInteger delayStep = new AtomicInteger();
        AtomicInteger stravaStep = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(queue::add,
                () -> { stravaStep.set(order.incrementAndGet()); return true; },
                () -> true,
                () -> {},
                90_000L,
                millis -> {
                    delayStep.set(order.incrementAndGet());
                    delayedMs.set(millis);
                });

        catchUp.afterStartup();
        catchUp.afterStartup();
        assertThat(queue).hasSize(1);
        assertThat(delayedMs).hasValue(-1L);

        queue.get(0).run();

        assertThat(delayedMs).hasValue(90_000L);
        assertThat(delayStep).hasValue(1);
        assertThat(stravaStep).hasValue(2);
        catchUp.afterStartup();
        assertThat(queue).hasSize(1);
    }

    @Test
    void interruptedDelaySkipsCatchUpWithoutRetryPolling() {
        AtomicInteger providerRuns = new AtomicInteger();
        SleepWakeCatchUp catchUp = new SleepWakeCatchUp(Runnable::run,
                () -> { providerRuns.incrementAndGet(); return true; },
                () -> { providerRuns.incrementAndGet(); return true; },
                providerRuns::incrementAndGet,
                1L,
                millis -> { throw new InterruptedException("test interrupt"); });

        catchUp.afterStartup();

        assertThat(providerRuns).hasValue(0);
        catchUp.afterStartup();
        assertThat(providerRuns).hasValue(0);
    }
}