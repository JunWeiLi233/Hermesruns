package com.hermes.backend.runtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;

/** One sequential catch-up pass off the readiness thread, never an idle polling loop. */
public final class SleepWakeCatchUp {
    private static final Logger log = LoggerFactory.getLogger(SleepWakeCatchUp.class);
    private final Executor executor;
    private final BooleanSupplier strava;
    private final BooleanSupplier garmin;
    private final Runnable coach;
    private final AtomicBoolean started = new AtomicBoolean();

    public SleepWakeCatchUp(Executor executor, BooleanSupplier strava, BooleanSupplier garmin, Runnable coach) {
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
            boolean stravaReady = runStep("Strava", strava);
            boolean garminReady = runStep("Garmin", garmin);
            if (stravaReady && garminReady) {
                runStep("Coach", () -> { coach.run(); return true; });
            } else {
                log.info("Sleep mode: coach audit deferred because a provider is busy or failed; no polling retry");
            }
            log.info("Sleep mode: wake catch-up pass complete; recurring network polling is disabled");
        });
    }

    private static boolean runStep(String name, BooleanSupplier step) {
        try {
            return step.getAsBoolean();
        } catch (RuntimeException error) {
            // Provider exceptions can contain URLs or credentials; log only the error type.
            log.warn("Sleep mode: {} wake step failed ({}); other steps will continue",
                    name, error.getClass().getSimpleName());
            return false;
        }
    }
}
