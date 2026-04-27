package com.hermes.backend;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class AdminBackgroundJobService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_SUMMARY_LENGTH = 240;

    private final AdminBackgroundJobRepository adminBackgroundJobRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public AdminBackgroundJobService(AdminBackgroundJobRepository adminBackgroundJobRepository) {
        this.adminBackgroundJobRepository = adminBackgroundJobRepository;
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

    public List<CourseMapScanStep> getCourseMapScanTimeline(String raceId) {
        var typeFactory = JSON.getTypeFactory();
        List<AdminBackgroundJob> recent = adminBackgroundJobRepository.findTop5ByJobTypeInOrderByCreatedAtDesc(
                List.of("COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"));
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
    }
}
