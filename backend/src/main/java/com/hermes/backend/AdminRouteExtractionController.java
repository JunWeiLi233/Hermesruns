package com.hermes.backend;

import jakarta.annotation.PreDestroy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/admin/marathon-pipeline")
public class AdminRouteExtractionController {
    /** Terminal job statuses are pruned oldest-first beyond this count so the map cannot grow forever. */
    private static final int MAX_RETAINED_JOBS = 50;

    private final AuthService authService;
    private final MarathonRoutePipelineService pipelineService;
    private final AdminAuditService adminAuditService;
    private final ExecutorService executorService = Executors.newFixedThreadPool(
            2,
            r -> {
                Thread t = new Thread(r, "marathon-pipeline-worker");
                t.setDaemon(true);
                return t;
            }
    );
    private final Map<String, JobStatus> jobs = new ConcurrentHashMap<>();
    private final AtomicLong jobSequence = new AtomicLong();

    public AdminRouteExtractionController(
            AuthService authService,
            MarathonRoutePipelineService pipelineService,
            AdminAuditService adminAuditService
    ) {
        this.authService = authService;
        this.pipelineService = pipelineService;
        this.adminAuditService = adminAuditService;
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }

    public enum JobState { PENDING, RUNNING, SUCCESS, FAILURE }

    public static class JobStatus {
        public String jobId;
        public JobState state;
        public String error;
        public MarathonRoutePipelineService.PipelineResult result;
        /** Insertion order used for pruning; package-private so it stays out of JSON responses. */
        long sequence;
    }

    @PostMapping("/run")
    public ResponseEntity<?> runPipeline(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody MarathonRoutePipelineRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty() || !"ADMIN".equals(runnerOptional.get().getRole())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ValidationResult validation = validateRequest(request);
        if (!validation.valid()) {
            return ResponseEntity.badRequest().body(Map.of("error", validation.message()));
        }

        String jobId = UUID.randomUUID().toString();
        JobStatus status = new JobStatus();
        status.jobId = jobId;
        status.state = JobState.PENDING;
        status.sequence = jobSequence.incrementAndGet();
        jobs.put(jobId, status);

        executorService.submit(() -> {
            status.state = JobState.RUNNING;
            try {
                MarathonRoutePipelineService.PipelineResult result = pipelineService.runPipeline(
                        runnerOptional.get(),
                        request.raceId(),
                        request.raceName(),
                        request.city(),
                        request.country(),
                        request.officialWebsite(),
                        request.resolvedLatitude(),
                        request.resolvedLongitude(),
                        request.distanceKm(),
                        request.imageFilePath()
                );

                status.result = result;
                status.state = JobState.SUCCESS;

                adminAuditService.log(
                        runnerOptional.get(),
                        "RUN_MARATHON_PIPELINE",
                        "Race",
                        request.raceId(),
                        "Successfully ran marathon pipeline for " + request.raceName()
                );
            } catch (Exception e) {
                status.error = e.getMessage();
                status.state = JobState.FAILURE;

                adminAuditService.log(
                        runnerOptional.get(),
                        "RUN_MARATHON_PIPELINE",
                        "Race",
                        request.raceId(),
                        "Failed to run marathon pipeline: " + e.getMessage()
                );
            } finally {
                pruneFinishedJobs();
            }
        });
        pruneFinishedJobs();

        return ResponseEntity.accepted().body(Map.of("jobId", jobId));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<?> getJobStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable String jobId
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty() || !"ADMIN".equals(runnerOptional.get().getRole())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        JobStatus status = jobs.get(jobId);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(status);
    }

    private ValidationResult validateRequest(MarathonRoutePipelineRequest request) {
        if (request.raceId() == null || request.raceId().isBlank()) return new ValidationResult(false, "raceId is required.");
        if (request.raceName() == null || request.raceName().isBlank()) return new ValidationResult(false, "raceName is required.");
        if (request.city() == null || request.city().isBlank()) return new ValidationResult(false, "city is required.");
        if (request.country() == null || request.country().isBlank()) return new ValidationResult(false, "country is required.");
        if (request.imageFilePath() == null || request.imageFilePath().isBlank()) return new ValidationResult(false, "imageFilePath is required.");
        return new ValidationResult(true, null);
    }

    /**
     * Drops the oldest terminal (SUCCESS/FAILURE) job entries beyond {@link #MAX_RETAINED_JOBS}.
     * PENDING/RUNNING jobs are never removed, and a terminal state is the last
     * status mutation a job ever receives, so pruning cannot race with an active
     * job's status updates. Job ids are UUIDs and never reused, so removing a
     * mapped entry is always final.
     */
    void pruneFinishedJobs() {
        if (jobs.size() <= MAX_RETAINED_JOBS) {
            return;
        }
        List<JobStatus> finished = new ArrayList<>();
        for (JobStatus job : jobs.values()) {
            if (job.state == JobState.SUCCESS || job.state == JobState.FAILURE) {
                finished.add(job);
            }
        }
        finished.sort(Comparator.comparingLong(job -> job.sequence));
        int excess = jobs.size() - MAX_RETAINED_JOBS;
        for (int i = 0; i < finished.size() && excess > 0; i++) {
            JobStatus job = finished.get(i);
            if (jobs.remove(job.jobId, job)) {
                excess--;
            }
        }
    }

    int jobCountForTests() {
        return jobs.size();
    }

    private record ValidationResult(boolean valid, String message) {}
}
