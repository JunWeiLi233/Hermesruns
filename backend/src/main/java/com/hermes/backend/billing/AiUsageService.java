package com.hermes.backend.billing;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiUsageService {

    private final RunnerRepository runnerRepository;
    private final int perRunnerDailyLimit;
    private final int projectDailyLimit;
    private final int projectDailyReserve;
    @PersistenceContext
    private EntityManager entityManager;

    public AiUsageService(
            RunnerRepository runnerRepository,
            @Value("${app.ai.free-tier.per-runner-daily-limit:5}") int perRunnerDailyLimit,
            @Value("${app.ai.free-tier.project-daily-limit:200}") int projectDailyLimit,
            @Value("${app.ai.free-tier.project-daily-reserve:20}") int projectDailyReserve) {
        this.runnerRepository = runnerRepository;
        this.perRunnerDailyLimit = Math.max(1, perRunnerDailyLimit);
        this.projectDailyLimit = Math.max(1, projectDailyLimit);
        this.projectDailyReserve = Math.max(0, Math.min(projectDailyReserve, this.projectDailyLimit - 1));
    }

    /**
     * Call for every new account (email signup, Google/Strava first save).
     */
    public void initNewUser(Runner runner) {
        runner.setSubscriptionTier("FREE");
        runner.setProExpiresAt(null);
        runner.setAiWelcomeScansRemaining(0);
        runner.setAiExperiencePhase(null);
        runner.setAiFreeScansRemaining(0);
        runner.setAiDailyLastUsedDate(null);
        runner.setAiMonthlyScansUsed(0);
        runner.setAiMonthlyResetDate(null);
        runner.setAiDailyScansUsed(0);
        runner.setAiDailyResetDate(LocalDate.now());
    }

    /**
     * Returns null when a scan is allowed, or a stable error code if blocked.
     * <p>
     * This is an advisory status check. Use tryConsumeQuota to reserve before a provider call.
     * </p>
     */
    public String checkQuota(Runner runner) {
        normalizeDailyWindow(runner);

        if (runner.getAiDailyScansUsed() >= perRunnerDailyLimit) {
            return "AI_FREE_TIER_USER_LIMIT";
        }

        if (getProjectDailyUsage() >= getEffectiveProjectDailyLimit()) {
            return "AI_FREE_TIER_PROJECT_LIMIT";
        }

        return null;
    }

    /**
     * Atomic check-and-consume: tries to reserve one scan slot for the runner.
     * Returns null on success (slot reserved and persisted), or an error code if blocked.
     * This prevents the check-then-act race where multiple threads pass checkQuota
     * before any thread calls recordUsage.
     * <p>
     * Pro and admin users skip the quota check entirely.
     * </p>
     */
    @Transactional
    public synchronized String tryConsumeQuota(Runner runner) {
        Runner requestedRunner = runner;
        runner = runnerRepository.findByIdForUpdate(runner.getId()).orElseThrow();
        // OSIV may have loaded this managed account before a concurrent reservation committed.
        if (entityManager != null) entityManager.refresh(runner, LockModeType.PESSIMISTIC_WRITE);
        // Pro and admin runners are unlimited
        if (isProOrAdmin(runner)) {
            requestedRunner.setSubscriptionTier(runner.getSubscriptionTier());
            requestedRunner.setProExpiresAt(runner.getProExpiresAt());
            requestedRunner.setRole(runner.getRole());
            return null;
        }

        normalizeDailyWindow(runner);

        if (runner.getAiDailyScansUsed() >= perRunnerDailyLimit) {
            copyDailyUsage(runner, requestedRunner);
            return "AI_FREE_TIER_USER_LIMIT";
        }

        if (getProjectDailyUsage() >= getEffectiveProjectDailyLimit()) {
            return "AI_FREE_TIER_PROJECT_LIMIT";
        }

        runner.setAiDailyScansUsed(runner.getAiDailyScansUsed() + 1);
        runner.setAiDailyLastUsedDate(LocalDate.now());
        runnerRepository.save(runner);
        copyDailyUsage(runner, requestedRunner);
        return null;
    }

    /**
     * Record one successful AI scan against the shared Gemini free-tier budget.
     * No-op for Pro and admin runners.
     */
    public void recordUsage(Runner runner) {
        if (isProOrAdmin(runner)) return;
        normalizeDailyWindow(runner);
        runner.setAiDailyScansUsed(runner.getAiDailyScansUsed() + 1);
        runner.setAiDailyLastUsedDate(LocalDate.now());
        runnerRepository.save(runner);
    }

    /**
     * Frontend status for the shoe scan UI.
     */
    public Map<String, Object> getUsageStatus(Runner runner) {
        boolean proOrAdmin = isProOrAdmin(runner);

        if (!proOrAdmin) {
            normalizeDailyWindow(runner);
        }

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("tier", proOrAdmin ? runner.getSubscriptionTier() : "FREE");
        status.put("admin", "ADMIN".equals(runner.getRole()));
        status.put("unlimited", proOrAdmin);

        if (proOrAdmin) {
            status.put("quotaType", "unlimited");
            status.put("scansRemaining", -1);
            status.put("dailyLimit", -1);
            status.put("dailyUsed", 0);
            status.put("projectDailyLimit", -1);
            status.put("projectDailyUsed", 0);
            status.put("projectDailyReserve", 0);
            status.put("resetsAt", null);
        } else {
            long projectDailyUsed = getProjectDailyUsage();
            int effectiveProjectDailyLimit = getEffectiveProjectDailyLimit();
            int runnerRemaining = Math.max(0, perRunnerDailyLimit - runner.getAiDailyScansUsed());
            int projectRemaining = (int) Math.max(0, effectiveProjectDailyLimit - projectDailyUsed);

            status.put("quotaType", "free_tier_daily");
            status.put("scansRemaining", Math.max(0, Math.min(runnerRemaining, projectRemaining)));
            status.put("dailyLimit", perRunnerDailyLimit);
            status.put("dailyUsed", runner.getAiDailyScansUsed());
            status.put("projectDailyLimit", effectiveProjectDailyLimit);
            status.put("projectDailyUsed", projectDailyUsed);
            status.put("projectDailyReserve", projectDailyReserve);
            status.put("resetsAt", LocalDate.now().plusDays(1).atStartOfDay().toString());
        }
        return status;
    }

    /**
     * Rollback a previously consumed quota slot when the API call fails.
     * Decrements the runner's daily counter by 1 (floor at 0) and persists.
     * No-op for Pro and admin runners (they were never charged).
     */
    @Transactional
    public synchronized void rollbackConsumedQuota(Runner runner) {
        if (isProOrAdmin(runner)) return;
        LocalDate reservationDate = runner.getAiDailyResetDate();
        Runner fresh = runnerRepository.findByIdForUpdate(runner.getId()).orElseThrow();
        if (entityManager != null) entityManager.refresh(fresh, LockModeType.PESSIMISTIC_WRITE);
        // A slow failed request must never refund a reservation from a newer UTC/local daily window.
        if (!java.util.Objects.equals(fresh.getAiDailyResetDate(), reservationDate)) return;
        int current = fresh.getAiDailyScansUsed();
        if (current > 0) {
            fresh.setAiDailyScansUsed(current - 1);
            runnerRepository.save(fresh);
            copyDailyUsage(fresh, runner);
        }
    }

    public void grantPro(Runner runner, int months) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime currentExpiry = runner.getProExpiresAt();
        LocalDateTime extensionStart = currentExpiry != null && currentExpiry.isAfter(now) ? currentExpiry : now;

        runner.setSubscriptionTier("PRO");
        runner.setProExpiresAt(extensionStart.plusMonths(Math.max(1, months)));
        runnerRepository.save(runner);
    }

    public void revokePro(Runner runner) {
        runner.setSubscriptionTier("FREE");
        runner.setProExpiresAt(null);
        runnerRepository.save(runner);
    }

    private boolean isProOrAdmin(Runner runner) {
        if (runner == null) return false;
        if ("ADMIN".equals(runner.getRole())) return true;
        if (!"PRO".equals(runner.getSubscriptionTier())) return false;
        java.time.LocalDateTime expiresAt = runner.getProExpiresAt();
        return expiresAt == null || expiresAt.isAfter(java.time.LocalDateTime.now());
    }

    private void normalizeDailyWindow(Runner runner) {
        LocalDate today = LocalDate.now();
        if (!today.equals(runner.getAiDailyResetDate())) {
            runner.setAiDailyResetDate(today);
            runner.setAiDailyScansUsed(0);
        }
    }

    private static void copyDailyUsage(Runner source, Runner target) {
        target.setAiDailyScansUsed(source.getAiDailyScansUsed());
        target.setAiDailyResetDate(source.getAiDailyResetDate());
        target.setAiDailyLastUsedDate(source.getAiDailyLastUsedDate());
    }

    private long getProjectDailyUsage() {
        return runnerRepository.sumAiDailyScansUsedForDate(LocalDate.now());
    }

    private int getEffectiveProjectDailyLimit() {
        return Math.max(1, projectDailyLimit - projectDailyReserve);
    }
}
