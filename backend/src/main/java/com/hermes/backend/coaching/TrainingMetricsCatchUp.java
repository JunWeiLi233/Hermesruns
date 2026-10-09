package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityType;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/**
 * After every start, works out the metrics of runs that have none: runs imported before this feature
 * existed, and runs whose computation was lost when the server stopped. Bounded and newest first, so a big
 * history is caught up over several starts instead of loading a small server in one go. Runs the runner
 * opens are computed on the spot anyway, so this only makes sure nothing stays missing forever.
 */
@Component
class TrainingMetricsCatchUp {

    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsCatchUp.class);

    private final ActivityTrainingMetricsRepository metrics;
    private final TrainingMetricsService service;
    private final TrainingMetricsExecutors executors;
    private final boolean enabled;
    private final int maxRuns;

    TrainingMetricsCatchUp(ActivityTrainingMetricsRepository metrics,
                           TrainingMetricsService service,
                           TrainingMetricsExecutors executors,
                           @Value("${app.training.catchup-on-startup:true}") boolean enabled,
                           @Value("${app.training.catchup-max-runs:500}") int maxRuns) {
        this.metrics = metrics;
        this.service = service;
        this.executors = executors;
        this.enabled = enabled;
        this.maxRuns = Math.max(1, maxRuns);
    }

    @EventListener(ApplicationReadyEvent.class)
    void afterStartup() {
        if (enabled) {
            executors.bulk(() -> {
                try {
                    int done = runOnce();
                    if (done > 0) {
                        log.info("Computed training metrics for {} runs that had none", done);
                    }
                } catch (RuntimeException failure) {
                    log.warn("Training metrics catch-up stopped ({})", failure.getClass().getSimpleName());
                }
            });
        }
    }

    /** One bounded pass; returns how many runs were computed. */
    int runOnce() {
        List<Object[]> missing = metrics.findNewestRunIdsWithoutMetrics(ActivityType.RUN, PageRequest.of(0, maxRuns));
        int done = 0;
        for (Object[] run : missing) {
            Long activityId = ((Number) run[0]).longValue();
            Long runnerId = ((Number) run[1]).longValue();
            try {
                if (service.computeAndStore(runnerId, activityId).isPresent()) {
                    done++;
                }
            } catch (RuntimeException failure) {
                log.warn("Training metrics for activity {} could not be computed ({})", activityId, failure.getClass().getSimpleName());
            }
        }
        return done;
    }
}
