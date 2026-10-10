package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.admin.AdminBackgroundJob;
import com.hermes.backend.admin.AdminBackgroundJobService;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Starts a background job that recomputes training metrics: for one runner or for everyone. Progress and
 * the result show in the administrator's job list. {@code /api/admin/**} is also guarded centrally by
 * the admin security filter; the check here is the second lock.
 */
@RestController
@RequestMapping("/api/admin/jobs")
public class TrainingMetricsAdminController {

    static final String JOB_TYPE = "TRAINING_METRICS_RECOMPUTE";
    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsAdminController.class);

    /**
     * @param runnerId limit the job to one runner; null for every runner with runs
     * @param force    recompute every run, not only the ones that are missing or out of date
     */
    public record RecomputeBody(Long runnerId, Boolean force) {
    }

    private final AuthService authService;
    private final AdminBackgroundJobService jobs;
    private final TrainingMetricsRecomputeService recompute;
    private final ActivityRepository activities;
    private final RunnerRepository runners;

    public TrainingMetricsAdminController(AuthService authService,
                                          AdminBackgroundJobService jobs,
                                          TrainingMetricsRecomputeService recompute,
                                          ActivityRepository activities,
                                          RunnerRepository runners) {
        this.authService = authService;
        this.jobs = jobs;
        this.recompute = recompute;
        this.activities = activities;
        this.runners = runners;
    }

    @PostMapping("/training-metrics-recompute")
    public ResponseEntity<?> start(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) RecomputeBody body) {
        Optional<Runner> admin = authService.findByAuthorizationHeader(authorizationHeader).filter(authService::isAdmin);
        if (admin.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin privileges required."));
        }
        boolean force = body != null && Boolean.TRUE.equals(body.force());
        List<Long> runnerIds;
        if (body != null && body.runnerId() != null) {
            if (!runners.existsById(body.runnerId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Runner not found."));
            }
            runnerIds = List.of(body.runnerId());
        } else {
            runnerIds = activities.findDistinctRunnerIdsWithActivityType(ActivityType.RUN);
        }

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runners", runnerIds.size());
        details.put("force", force);
        AdminBackgroundJob job = jobs.createJob(JOB_TYPE, "admin_request", admin.get(),
                "Recompute training metrics for " + runnerIds.size() + " runner(s)", details);
        jobs.runAsync(job, runnerIds.size(), () -> run(job, runnerIds, force));
        return ResponseEntity.accepted().body(Map.of("jobId", job.getId(), "status", job.getStatus(), "runners", runnerIds.size()));
    }

    private void run(AdminBackgroundJob job, List<Long> runnerIds, boolean force) {
        int succeeded = 0;
        int failedRunners = 0;
        int recomputed = 0;
        int failedRuns = 0;
        for (Long runnerId : runnerIds) {
            try {
                TrainingMetricsRecomputeService.Outcome outcome = recompute.recomputeRunner(runnerId, force);
                recomputed += outcome.recomputed();
                failedRuns += outcome.failed();
                succeeded++;
            } catch (RuntimeException failure) {
                failedRunners++;
                log.warn("Recomputing training metrics for runner {} failed ({})", runnerId, failure.getClass().getSimpleName());
            }
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runners", runnerIds.size());
        details.put("force", force);
        details.put("runsRecomputed", recomputed);
        details.put("runsFailed", failedRuns);
        jobs.markCompleted(job, succeeded, failedRunners + failedRuns,
                "Recomputed " + recomputed + " run(s) for " + succeeded + " runner(s)"
                        + (failedRuns > 0 || failedRunners > 0 ? "; " + failedRuns + " run(s) and " + failedRunners + " runner(s) failed" : ""),
                details);
    }
}
