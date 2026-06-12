package com.hermes.backend;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.type.TypeFactory;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class AdminBackgroundJobService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_SUMMARY_LENGTH = 240;
    private static final List<String> COURSE_MAP_SCAN_JOB_TYPES = List.of(
            "COURSE_MAP_PREVIEW_SCAN",
            "COURSE_MAP_PREVIEW_REANALYZE",
            "COURSE_MAP_PREVIEW_UPLOAD");
    private static final String ORPHANED_COURSE_MAP_SUMMARY =
            "Previous course-map scan was interrupted by a Hermes restart. Re-analyze the pending upload to queue a fresh scan.";
    private static final String ORPHANED_PENDING_COURSE_MAP_SUMMARY =
            "Previous course-map scan was queued before this Hermes worker started. Re-analyze the pending upload to queue a fresh scan.";
    private static final String UNOWNED_COURSE_MAP_SUMMARY =
            "Previous course-map scan no longer has an active worker. Re-analyze the pending upload to queue a fresh scan.";
    private static final String UNOWNED_PENDING_COURSE_MAP_SUMMARY =
            "Previous course-map scan was queued before this Hermes worker started. Re-analyze the pending upload to queue a fresh scan.";
    private static final String ABANDONED_COURSE_MAP_SUMMARY =
            "Course-map scan worker exited without recording a terminal status. Re-analyze the pending upload to queue a fresh scan.";
    private static final String INTERRUPTED_COURSE_MAP_SUMMARY =
            "Course-map scan stopped before recording a terminal status. Re-analyze the pending upload to queue a fresh scan.";
    private static final String WAITING_COURSE_MAP_SUMMARY =
            "Course-map scan stopped while waiting for the FIFO lane. Re-analyze the pending upload to queue a fresh scan.";
    private static final ReentrantLock COURSE_MAP_SCAN_LOCK = new ReentrantLock(true);
    private static final Set<Long> COURSE_MAP_OWNED_JOB_IDS = ConcurrentHashMap.newKeySet();
    private static final Set<Long> COURSE_MAP_ACTIVE_JOB_IDS = ConcurrentHashMap.newKeySet();
    private static final long COURSE_MAP_SCAN_QUEUE_POLL_MILLIS = 250;

    private final AdminBackgroundJobRepository adminBackgroundJobRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    private final ExecutorService courseMapScanExecutor = Executors.newSingleThreadExecutor();

    public AdminBackgroundJobService(AdminBackgroundJobRepository adminBackgroundJobRepository) {
        this.adminBackgroundJobRepository = adminBackgroundJobRepository;
    }

    @PostConstruct
    void recoverOrphanedCourseMapScanJobs() {
        failCourseMapJobsByStatus(AdminBackgroundJob.STATUS_RUNNING, ORPHANED_COURSE_MAP_SUMMARY);
        failCourseMapJobsByStatus(AdminBackgroundJob.STATUS_PENDING, ORPHANED_PENDING_COURSE_MAP_SUMMARY);
    }

    private void failCourseMapJobsByStatus(String status, String summary) {
        List<AdminBackgroundJob> orphanedJobs = adminBackgroundJobRepository.findByJobTypeInAndStatus(
                COURSE_MAP_SCAN_JOB_TYPES,
                status);
        if (orphanedJobs == null || orphanedJobs.isEmpty()) {
            return;
        }
        for (AdminBackgroundJob job : orphanedJobs) {
            failCourseMapScanIfStillActive(job, job.getTotalCount(), summary);
        }
    }

    public AdminBackgroundJob createJob(String type, String triggerSource, Runner actor, String summary, Map<String, Object> details) {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType(type);
        job.setTriggerSource(triggerSource);
        job.setSummary(truncateSummary(summary));
        if (actor != null) {
            job.setCreatedByRunnerId(actor.getId());
            job.setCreatedByEmail(actor.getEmail());
        }
        job.setDetailsJson(writeJson(details));
        return adminBackgroundJobRepository.save(job);
    }

    public void markRunning(AdminBackgroundJob job, int totalCount) {
        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.setStartedAt(LocalDateTime.now());
        job.setTotalCount(totalCount);
        adminBackgroundJobRepository.save(job);
    }

    public void markCompleted(AdminBackgroundJob job, int successCount, int failureCount, String summary, Map<String, Object> details) {
        job.setStatus(failureCount > 0 ? AdminBackgroundJob.STATUS_FAILED : AdminBackgroundJob.STATUS_COMPLETED);
        job.setFinishedAt(LocalDateTime.now());
        job.setSuccessCount(successCount);
        job.setFailureCount(failureCount);
        job.setSummary(truncateSummary(summary));
        job.setDetailsJson(writeJson(details));
        adminBackgroundJobRepository.save(job);
    }

    public void updateDetails(AdminBackgroundJob job, Map<String, Object> details) {
        job.setDetailsJson(writeJson(details));
        adminBackgroundJobRepository.save(job);
    }

    public void runAsync(AdminBackgroundJob job, int totalCount, Runnable task) {
        markRunning(job, totalCount);
        executor.submit(task);
    }

    public void runCourseMapScanAsync(AdminBackgroundJob job, int totalCount, Runnable task) {
        job.setStatus(AdminBackgroundJob.STATUS_PENDING);
        job.setTotalCount(totalCount);
        adminBackgroundJobRepository.save(job);
        boolean owned = markCourseMapScanOwned(job);
        courseMapScanExecutor.submit(() -> {
            COURSE_MAP_SCAN_LOCK.lock();
            boolean started = false;
            boolean active = false;
            try {
                waitForCourseMapScanTurn(job, totalCount);
                active = markCourseMapScanActive(job);
                started = true;
                task.run();
                failCourseMapScanIfStillActive(job, totalCount, ABANDONED_COURSE_MAP_SUMMARY);
            } catch (Throwable ex) {
                failCourseMapScanIfStillActive(job, totalCount,
                        started ? INTERRUPTED_COURSE_MAP_SUMMARY : WAITING_COURSE_MAP_SUMMARY);
                throw ex;
            } finally {
                if (active) {
                    clearCourseMapScanActive(job);
                }
                if (owned) {
                    clearCourseMapScanOwned(job);
                }
                COURSE_MAP_SCAN_LOCK.unlock();
            }
        });
    }

    public List<CourseMapScanStep> getCourseMapScanTimeline(String raceId) {
        var typeFactory = JSON.getTypeFactory();
        List<AdminBackgroundJob> recent = adminBackgroundJobRepository.findTop5ByJobTypeInOrderByCreatedAtDesc(
                COURSE_MAP_SCAN_JOB_TYPES);
        for (AdminBackgroundJob job : recent) {
            if (job.getDetailsJson() == null || job.getDetailsJson().isBlank()) continue;
            try {
                Map<String, Object> details = JSON.readValue(
                        job.getDetailsJson(),
                        typeFactory.constructMapType(LinkedHashMap.class, String.class, Object.class));
                Object raceIdValue = details.get("raceId");
                if (raceIdValue != null && raceId.equals(String.valueOf(raceIdValue))) {
                    Object steps = details.get("qwenScanSteps");
                    if (steps instanceof List<?> rawSteps && !rawSteps.isEmpty()) {
                        return JSON.convertValue(rawSteps, typeFactory.constructCollectionType(List.class, CourseMapScanStep.class));
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return List.of();
    }

    private void waitForCourseMapScanTurn(AdminBackgroundJob job, int totalCount) {
        if (job.getId() == null) {
            markRunning(job, totalCount);
            return;
        }
        while (true) {
            if (tryClaimCourseMapScanTurn(job, totalCount)) {
                return;
            }
            try {
                Thread.sleep(COURSE_MAP_SCAN_QUEUE_POLL_MILLIS);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for the course-map scan FIFO lane.", ex);
            }
        }
    }

    private boolean tryClaimCourseMapScanTurn(AdminBackgroundJob job, int totalCount) {
        List<AdminBackgroundJob> runningJobs = adminBackgroundJobRepository.findByJobTypeInAndStatus(
                COURSE_MAP_SCAN_JOB_TYPES,
                AdminBackgroundJob.STATUS_RUNNING);
        boolean anotherScanIsRunning = runningJobs != null && runningJobs.stream()
                .filter(runningJob -> !Objects.equals(runningJob.getId(), job.getId()))
                .anyMatch(this::isCourseMapScanActive);
        if (anotherScanIsRunning) {
            return false;
        }
        recoverUnownedCourseMapScanJobs(job, runningJobs);
        recoverUnownedCourseMapPendingJobs(job);

        LocalDateTime startedAt = LocalDateTime.now();
        int claimed = adminBackgroundJobRepository.claimCourseMapScanTurn(
                job.getId(),
                COURSE_MAP_SCAN_JOB_TYPES,
                AdminBackgroundJob.STATUS_PENDING,
                AdminBackgroundJob.STATUS_RUNNING,
                startedAt,
                totalCount);
        if (claimed <= 0) {
            return false;
        }

        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.setStartedAt(startedAt);
        job.setTotalCount(totalCount);
        return true;
    }

    private void recoverUnownedCourseMapPendingJobs(AdminBackgroundJob currentJob) {
        List<AdminBackgroundJob> pendingJobs = adminBackgroundJobRepository.findByJobTypeInAndStatus(
                COURSE_MAP_SCAN_JOB_TYPES,
                AdminBackgroundJob.STATUS_PENDING);
        if (pendingJobs == null || pendingJobs.isEmpty()) {
            return;
        }
        for (AdminBackgroundJob pendingJob : pendingJobs) {
            if (Objects.equals(pendingJob.getId(), currentJob.getId()) || isCourseMapScanOwned(pendingJob)) {
                continue;
            }
            failCourseMapScanIfStillActive(pendingJob, pendingJob.getTotalCount(), UNOWNED_PENDING_COURSE_MAP_SUMMARY);
        }
    }

    private void recoverUnownedCourseMapScanJobs(AdminBackgroundJob currentJob, List<AdminBackgroundJob> runningJobs) {
        if (runningJobs == null || runningJobs.isEmpty()) {
            return;
        }
        for (AdminBackgroundJob runningJob : runningJobs) {
            if (Objects.equals(runningJob.getId(), currentJob.getId()) || isCourseMapScanActive(runningJob)) {
                continue;
            }
            failCourseMapScanIfStillActive(runningJob, runningJob.getTotalCount(), UNOWNED_COURSE_MAP_SUMMARY);
        }
    }

    private boolean markCourseMapScanOwned(AdminBackgroundJob job) {
        if (job.getId() == null) {
            return false;
        }
        COURSE_MAP_OWNED_JOB_IDS.add(job.getId());
        return true;
    }

    private void clearCourseMapScanOwned(AdminBackgroundJob job) {
        if (job.getId() != null) {
            COURSE_MAP_OWNED_JOB_IDS.remove(job.getId());
        }
    }

    private boolean isCourseMapScanOwned(AdminBackgroundJob job) {
        return job != null && job.getId() != null && COURSE_MAP_OWNED_JOB_IDS.contains(job.getId());
    }

    private boolean markCourseMapScanActive(AdminBackgroundJob job) {
        if (job.getId() == null) {
            return false;
        }
        COURSE_MAP_ACTIVE_JOB_IDS.add(job.getId());
        return true;
    }

    private void clearCourseMapScanActive(AdminBackgroundJob job) {
        if (job.getId() != null) {
            COURSE_MAP_ACTIVE_JOB_IDS.remove(job.getId());
        }
    }

    private boolean isCourseMapScanActive(AdminBackgroundJob job) {
        return job != null && job.getId() != null && COURSE_MAP_ACTIVE_JOB_IDS.contains(job.getId());
    }

    private void failCourseMapScanIfStillActive(AdminBackgroundJob job, int totalCount, String summary) {
        if (isTerminalStatus(job.getStatus())) {
            return;
        }
        job.setStatus(AdminBackgroundJob.STATUS_FAILED);
        job.setFinishedAt(LocalDateTime.now());
        job.setSuccessCount(0);
        job.setFailureCount(Math.max(1, totalCount));
        job.setSummary(truncateSummary(summary));
        adminBackgroundJobRepository.save(job);
    }

    private boolean isTerminalStatus(String status) {
        return AdminBackgroundJob.STATUS_COMPLETED.equals(status)
                || AdminBackgroundJob.STATUS_FAILED.equals(status);
    }

    private String writeJson(Map<String, Object> details) {
        try {
            return JSON.writeValueAsString(details == null ? Map.of() : new LinkedHashMap<>(details));
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String truncateSummary(String summary) {
        if (summary == null || summary.length() <= MAX_SUMMARY_LENGTH) {
            return summary;
        }
        return summary.substring(0, MAX_SUMMARY_LENGTH - 3) + "...";
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
        courseMapScanExecutor.shutdown();
    }
}
