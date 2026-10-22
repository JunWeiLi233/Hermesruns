package com.hermes.backend.activity;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/**
 * After every start, gives a climb figure to the runs that have none but whose points carry elevation: runs imported from
 * a GPX, TCX or FIT file before the importer worked the climb out (BUG-036). Bounded and newest first, so a big history is
 * caught up over several starts instead of loading a small server in one go. A run with no elevation at all is not looked
 * at again.
 */
@Component
class ElevationGainCatchUp {

    private static final Logger log = LoggerFactory.getLogger(ElevationGainCatchUp.class);

    private final ElevationGainRepository elevations;
    private final ElevationGainService service;
    private final boolean enabled;
    private final int maxRuns;
    private final ExecutorService executor;

    ElevationGainCatchUp(ElevationGainRepository elevations,
                         ElevationGainService service,
                         @Value("${app.elevation.catchup-on-startup:true}") boolean enabled,
                         @Value("${app.elevation.catchup-max-runs:500}") int maxRuns) {
        this.elevations = elevations;
        this.service = service;
        this.enabled = enabled;
        this.maxRuns = Math.max(1, maxRuns);
        this.executor = enabled
                ? Executors.newSingleThreadExecutor(runnable -> {
                    Thread thread = new Thread(runnable, "elevation-gain-catchup");
                    thread.setDaemon(true);
                    return thread;
                })
                : null;
    }

    @EventListener(ApplicationReadyEvent.class)
    void afterStartup() {
        if (enabled) {
            executor.execute(() -> {
                try {
                    int done = runOnce();
                    if (done > 0) {
                        log.info("Worked out the climb of {} runs that had none", done);
                    }
                } catch (RuntimeException failure) {
                    log.warn("Climb catch-up stopped ({})", failure.getClass().getSimpleName());
                }
            });
        }
    }

    /** One bounded pass; returns how many runs now have a climb figure. */
    int runOnce() {
        List<Long> missing = elevations.findNewestRunIdsWithoutClimb(ActivityType.RUN, PageRequest.of(0, maxRuns));
        int done = 0;
        for (Long activityId : missing) {
            try {
                if (service.fill(activityId)) {
                    done++;
                }
            } catch (RuntimeException failure) {
                log.warn("The climb of activity {} could not be worked out ({})", activityId, failure.getClass().getSimpleName());
            }
        }
        return done;
    }

    @PreDestroy
    void stop() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }
}
