package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Feature-gating quota service for premium features.
 * <p>
 * Pro users have unlimited access to all features (-1 = unlimited).
 * Free users have configurable monthly quotas per feature.
 * </p>
 */
@Service
public class QuotaService {

    private final RunnerRepository runnerRepository;

    private final int freeShoeScanLimit;
    private final int freeMusclePlanLimit;

    public QuotaService(
            RunnerRepository runnerRepository,
            @Value("${app.quota.free.shoe-scan:3}") int freeShoeScanLimit,
            @Value("${app.quota.free.muscle-plan:0}") int freeMusclePlanLimit) {
        this.runnerRepository = runnerRepository;
        this.freeShoeScanLimit = Math.max(0, freeShoeScanLimit);
        this.freeMusclePlanLimit = Math.max(0, freeMusclePlanLimit);
    }

    /**
     * Check whether a runner is currently Pro (active subscription, not expired).
     */
    public boolean isPro(Runner runner) {
        if (runner == null) return false;
        if ("ADMIN".equals(runner.getRole())) return true;
        if (!"PRO".equals(runner.getSubscriptionTier())) return false;
        LocalDateTime expiresAt = runner.getProExpiresAt();
        return expiresAt == null || expiresAt.isAfter(LocalDateTime.now());
    }

    /**
     * Check if a runner can use a given feature.
     * Pro users always pass. Free users are checked against their monthly quota.
     */
    public boolean canUseFeature(Runner runner, String featureKey) {
        if (isPro(runner)) return true;
        normalizeMonthlyWindow(runner, featureKey);
        int limit = getFeatureLimit(featureKey);
        if (limit <= 0) return false; // feature disabled for free tier
        int used = getFeatureUsage(runner, featureKey);
        return used < limit;
    }

    /**
     * Consume one use of a feature. No-op for Pro users.
     * Call only after {@link #canUseFeature} returns true.
     */
    public void consumeFeature(Runner runner, String featureKey) {
        if (isPro(runner)) return;
        normalizeMonthlyWindow(runner, featureKey);
        switch (featureKey) {
            case "shoe-scan" -> {
                runner.setShoeScanCount(runner.getShoeScanCount() + 1);
            }
            // muscle-plan and future features use separate counters
            default -> {
                // no counter yet for unknown features
            }
        }
        runnerRepository.save(runner);
    }

    /**
     * Get remaining quota for a feature. Returns -1 for unlimited (Pro).
     */
    public int remainingQuota(Runner runner, String featureKey) {
        if (isPro(runner)) return -1;
        normalizeMonthlyWindow(runner, featureKey);
        int limit = getFeatureLimit(featureKey);
        int used = getFeatureUsage(runner, featureKey);
        return Math.max(0, limit - used);
    }

    /**
     * Full quota status for the frontend, keyed by feature.
     * Pro users get unlimited for all features.
     */
    public Map<String, Object> getQuotaStatus(Runner runner) {
        Map<String, Object> status = new LinkedHashMap<>();
        boolean pro = isPro(runner);

        status.put("pro", pro);

        // shoe-scan
        Map<String, Object> shoeScan = new LinkedHashMap<>();
        if (pro) {
            shoeScan.put("used", 0);
            shoeScan.put("limit", -1);
            shoeScan.put("remaining", -1);
        } else {
            normalizeMonthlyWindow(runner, "shoe-scan");
            shoeScan.put("used", runner.getShoeScanCount());
            shoeScan.put("limit", freeShoeScanLimit);
            shoeScan.put("remaining", Math.max(0, freeShoeScanLimit - runner.getShoeScanCount()));
        }
        status.put("shoeScan", shoeScan);

        return status;
    }

    /**
     * Build a quota_exceeded error body consistent with the frontend contract.
     */
    public Map<String, Object> quotaExceededError(Runner runner, String featureKey) {
        normalizeMonthlyWindow(runner, featureKey);
        int limit = getFeatureLimit(featureKey);
        int used = getFeatureUsage(runner, featureKey);
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("error", "quota_exceeded");
        error.put("feature", featureKey);
        error.put("limit", limit);
        error.put("used", used);
        return error;
    }

    // ── internal helpers ──

    private int getFeatureLimit(String featureKey) {
        return switch (featureKey) {
            case "shoe-scan" -> freeShoeScanLimit;
            case "muscle-plan" -> freeMusclePlanLimit;
            default -> 0;
        };
    }

    private int getFeatureUsage(Runner runner, String featureKey) {
        return switch (featureKey) {
            case "shoe-scan" -> runner.getShoeScanCount();
            default -> 0;
        };
    }

    /**
     * Reset the monthly counter if we have crossed into a new calendar month.
     */
    private void normalizeMonthlyWindow(Runner runner, String featureKey) {
        LocalDate today = LocalDate.now();
        LocalDate resetDate = runner.getShoeScanCountReset();

        // First time: set reset to the 1st of current month
        if (resetDate == null) {
            resetDate = today.withDayOfMonth(1);
        }

        LocalDate currentMonthStart = today.withDayOfMonth(1);
        if (resetDate.isBefore(currentMonthStart)) {
            // New month: reset counters
            switch (featureKey) {
                case "shoe-scan" -> runner.setShoeScanCount(0);
            }
            runner.setShoeScanCountReset(currentMonthStart);
            runnerRepository.save(runner);
        }
    }
}
