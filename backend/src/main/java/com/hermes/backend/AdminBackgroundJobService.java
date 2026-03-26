package com.hermes.backend;

import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class AdminBackgroundJobService {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final AdminBackgroundJobRepository adminBackgroundJobRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public AdminBackgroundJobService(AdminBackgroundJobRepository adminBackgroundJobRepository) {
        this.adminBackgroundJobRepository = adminBackgroundJobRepository;
    }

    public AdminBackgroundJob createJob(String type, String triggerSource, Runner actor, String summary, Map<String, Object> details) {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType(type);
        job.setTriggerSource(triggerSource);
        job.setSummary(summary);
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
        job.setSummary(summary);
        job.setDetailsJson(writeJson(details));
        adminBackgroundJobRepository.save(job);
    }

    public void runAsync(AdminBackgroundJob job, int totalCount, Runnable task) {
        markRunning(job, totalCount);
        executor.submit(task);
    }

    private String writeJson(Map<String, Object> details) {
        try {
            return JSON.writeValueAsString(details == null ? Map.of() : new LinkedHashMap<>(details));
        } catch (Exception ex) {
            return "{}";
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }
}
