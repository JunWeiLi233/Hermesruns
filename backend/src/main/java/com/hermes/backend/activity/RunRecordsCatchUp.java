package com.hermes.backend.activity;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/**
 * After every start, analyses the runs that have not been: runs imported before this feature existed, runs whose analysis
 * was lost when the server stopped, and every run after the analysis changed ({@code BestEffortService.MODEL_VERSION}).
 * Bounded and newest first, so a big history is caught up over several starts instead of loading a small server in one
 * go. Runs whose records are read are analysed on the spot anyway, so this only makes sure nothing stays missing for
 * ever. It also removes route groups that no run belongs to any more.
 */
@Component
class RunRecordsCatchUp {

    private static final Logger log = LoggerFactory.getLogger(RunRecordsCatchUp.class);

    private final ActivityRecordsRepository records;
    private final RunRecordsCoordinator coordinator;
    private final RouteMatchService routes;
    private final RunRecordsExecutors executors;
    private final boolean enabled;
    private final int maxRuns;

    RunRecordsCatchUp(ActivityRecordsRepository records,
                      RunRecordsCoordinator coordinator,
                      RouteMatchService routes,
                      RunRecordsExecutors executors,
                      @Value("${app.records.catchup-on-startup:true}") boolean enabled,
                      @Value("${app.records.catchup-max-runs:500}") int maxRuns) {
        this.records = records;
        this.coordinator = coordinator;
        this.routes = routes;
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
                        log.info("Analysed {} runs for their best efforts and routes", done);
                    }
                } catch (RuntimeException failure) {
                    log.warn("Run records catch-up stopped ({})", failure.getClass().getSimpleName());
                }
            });
        }
    }

    /** One bounded pass; returns how many runs were analysed. */
    int runOnce() {
        List<Object[]> pending = records.findNewestPendingRuns(ActivityType.RUN, BestEffortService.MODEL_VERSION,
                PageRequest.of(0, maxRuns));
        int done = 0;
        for (Object[] run : pending) {
            Long activityId = ((Number) run[0]).longValue();
            Long runnerId = ((Number) run[1]).longValue();
            try {
                if (coordinator.processIfPending(runnerId, activityId)) {
                    done++;
                }
            } catch (RuntimeException failure) {
                log.warn("Records of activity {} could not be worked out ({})", activityId, failure.getClass().getSimpleName());
            }
        }
        routes.removeEmptyGroups();
        return done;
    }
}
