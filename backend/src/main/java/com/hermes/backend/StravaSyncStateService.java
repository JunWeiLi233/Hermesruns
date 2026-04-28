package com.hermes.backend;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class StravaSyncStateService {
    private final ConcurrentMap<Long, Tracker> states = new ConcurrentHashMap<>();

    public Tracker trackerFor(Long runnerId) {
        return states.computeIfAbsent(runnerId, ignored -> new Tracker());
    }

    public StravaSyncService.StravaSyncStatusResponse snapshot(Long runnerId) {
        Tracker tracker = states.get(runnerId);
        return tracker == null ? StravaSyncService.StravaSyncStatusResponse.idle() : tracker.snapshot();
    }

    @Scheduled(fixedDelay = 600_000)
    void cleanupStaleTrackers() {
        long cutoff = System.currentTimeMillis() - 1_800_000;
        states.entrySet().removeIf(entry -> entry.getValue().isStale(cutoff));
    }

    static final class Tracker {
        private String status = "IDLE";
        private int importedRuns;
        private int skippedNonRuns;
        private int skippedDuplicates;
        private int processedActivities;
        private int processedPages;
        private String error;
        private long lastUpdatedMs = System.currentTimeMillis();

        synchronized void resetForNewSync() {
            status = "PENDING";
            importedRuns = 0;
            skippedNonRuns = 0;
            skippedDuplicates = 0;
            processedActivities = 0;
            processedPages = 0;
            error = null;
        }

        synchronized boolean tryBeginSync() {
            if ("RUNNING".equals(status) || "PENDING".equals(status)) {
                return false;
            }
            resetForNewSync();
            status = "RUNNING";
            return true;
        }

        synchronized void incrementImportedRuns() {
            importedRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedNonRuns() {
            skippedNonRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedDuplicates() {
            skippedDuplicates++;
            processedActivities++;
        }

        synchronized void incrementProcessedPages() {
            processedPages++;
        }

        synchronized void markCompleted() {
            status = "COMPLETED";
            error = null;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markFailed(String message) {
            status = "FAILED";
            error = message;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean isStale(long cutoffMs) {
            return lastUpdatedMs < cutoffMs && !"RUNNING".equals(status) && !"PENDING".equals(status);
        }

        synchronized StravaSyncService.StravaSyncStatusResponse snapshot() {
            return new StravaSyncService.StravaSyncStatusResponse(
                    status,
                    importedRuns,
                    skippedNonRuns,
                    skippedDuplicates,
                    processedActivities,
                    processedPages,
                    error,
                    "RUNNING".equals(status) || "PENDING".equals(status),
                    "none",
                    false,
                    java.time.LocalDateTime.now().toString()
            );
        }
    }
}
