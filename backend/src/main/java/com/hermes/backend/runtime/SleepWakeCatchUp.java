package com.hermes.backend.runtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

/** One non-blocking catch-up dispatch per cold start, never an idle polling loop. */
public final class SleepWakeCatchUp {
    private static final Logger log = LoggerFactory.getLogger(SleepWakeCatchUp.class);
    private final Executor executor;
    private final Runnable strava;
    private final Runnable garmin;
    private final Runnable coach;
    private final AtomicBoolean started = new AtomicBoolean();

    public SleepWakeCatchUp(Executor executor, Runnable strava, Runnable garmin, Runnable coach) {
        this.executor = executor;
        this.strava = strava;
        this.garmin = garmin;
        this.coach = coach;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void afterStartup() {
        if (!started.compareAndSet(false, true)) {
            return;
        }
        executor.execute(() -> {
            log.info("Sleep mode: starting one wake catch-up pass");
            runStep("Strava", strava);
            runStep("Garmin", garmin);
            runStep("Coach", coach);
            log.info("Sleep mode: wake catch-up dispatch complete; recurring network polling is disabled");
        });
    }

    private static void runStep(String name, Runnable step) {
        try {
            step.run();
        } catch (RuntimeException error) {
            // Provider exceptions can contain URLs or credentials; log only the error type.
            log.warn("Sleep mode: {} wake step failed ({}); other steps will continue",
                    name, error.getClass().getSimpleName());
        }
    }
}
