package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiUsageService {

    public static final String PHASE_NEW_USER = "NEW_USER";
    public static final String PHASE_REGULAR_USER = "REGULAR_USER";

    private static final int NEW_USER_TRIAL_SCANS = 1;
    private static final int USER_FREE_SCANS = 3;
    private static final int PRO_MONTHLY_LIMIT = 50;

    private final RunnerRepository runnerRepository;

    public AiUsageService(RunnerRepository runnerRepository) {
        this.runnerRepository = runnerRepository;
    }

    /**
     * Call for every new account (email signup, Google/Strava first save).
     */
    public void initNewUser(Runner runner) {
        runner.setAiExperiencePhase(PHASE_NEW_USER);
        runner.setAiFreeScansRemaining(0);
        runner.setAiWelcomeScansRemaining(0);
        runner.setAiDailyLastUsedDate(null);
    }

    /**
     * Check if a runner can perform an AI scan right now.
     * Returns null if allowed, or an error code if blocked.
     */
    public String checkQuota(Runner runner) {
        if ("ADMIN".equals(runner.getRole())) {
            return null;
        }

        if (isPro(runner)) {
            resetMonthlyIfNeeded(runner);
            if (runner.getAiMonthlyScansUsed() >= PRO_MONTHLY_LIMIT) {
                return "PRO_MONTHLY_LIMIT";
            }
            return null;
        }

        migrateLegacyAiQuotaIfNeeded(runner);

        if (PHASE_NEW_USER.equals(runner.getAiExperiencePhase())) {
            return null;
        }
        if (PHASE_REGULAR_USER.equals(runner.getAiExperiencePhase()) && runner.getAiFreeScansRemaining() > 0) {
            return null;
        }
        return "AI_FREE_QUOTA_EXCEEDED";
    }

    /**
     * Record a successful AI scan usage.
     */
    public void recordUsage(Runner runner) {
        if ("ADMIN".equals(runner.getRole())) {
            return;
        }

        if (isPro(runner)) {
            resetMonthlyIfNeeded(runner);
            runner.setAiMonthlyScansUsed(runner.getAiMonthlyScansUsed() + 1);
            runnerRepository.save(runner);
            return;
        }

        migrateLegacyAiQuotaIfNeeded(runner);

        if (PHASE_NEW_USER.equals(runner.getAiExperiencePhase())) {
            runner.setAiExperiencePhase(PHASE_REGULAR_USER);
            runner.setAiFreeScansRemaining(USER_FREE_SCANS);
        } else if (PHASE_REGULAR_USER.equals(runner.getAiExperiencePhase()) && runner.getAiFreeScansRemaining() > 0) {
            runner.setAiFreeScansRemaining(runner.getAiFreeScansRemaining() - 1);
        }

        runnerRepository.save(runner);
    }

    /**
     * Get usage status info for the frontend.
     */
    public Map<String, Object> getUsageStatus(Runner runner) {
        Map<String, Object> status = new LinkedHashMap<>();
        boolean pro = isPro(runner);
        boolean admin = "ADMIN".equals(runner.getRole());

        status.put("tier", pro ? "PRO" : "FREE");
        status.put("admin", admin);

        if (admin) {
            status.put("unlimited", true);
            status.put("scansRemaining", -1);
            status.put("experiencePhase", null);
            return status;
        }

        if (pro) {
            resetMonthlyIfNeeded(runner);
            int remaining = Math.max(0, PRO_MONTHLY_LIMIT - runner.getAiMonthlyScansUsed());
            status.put("unlimited", false);
            status.put("scansRemaining", remaining);
            status.put("monthlyLimit", PRO_MONTHLY_LIMIT);
            status.put("monthlyUsed", runner.getAiMonthlyScansUsed());
            status.put("proExpiresAt", runner.getProExpiresAt() != null ? runner.getProExpiresAt().toString() : null);
            status.put("experiencePhase", null);
        } else {
            migrateLegacyAiQuotaIfNeeded(runner);
            String phase = runner.getAiExperiencePhase();
            status.put("unlimited", false);
            status.put("experiencePhase", phase);
            if (PHASE_NEW_USER.equals(phase)) {
                status.put("scansRemaining", NEW_USER_TRIAL_SCANS);
                status.put("quotaType", "new_user");
                status.put("userFreeTotal", USER_FREE_SCANS);
            } else {
                int freeLeft = runner.getAiFreeScansRemaining();
                status.put("scansRemaining", freeLeft);
                status.put("quotaType", "user_free");
                status.put("userFreeTotal", USER_FREE_SCANS);
            }
        }

        return status;
    }

    /**
     * Grant Pro subscription to a runner.
     */
    public void grantPro(Runner runner, int months) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime currentExpiry = runner.getProExpiresAt();

        LocalDateTime base = (currentExpiry != null && currentExpiry.isAfter(now)) ? currentExpiry : now;
        runner.setSubscriptionTier("PRO");
        runner.setProExpiresAt(base.plusMonths(months));
        runner.setAiMonthlyScansUsed(0);
        runner.setAiMonthlyResetDate(LocalDate.now().plusMonths(1).withDayOfMonth(1));
        runnerRepository.save(runner);
    }

    /**
     * Revoke Pro subscription.
     */
    public void revokePro(Runner runner) {
        runner.setSubscriptionTier("FREE");
        runner.setProExpiresAt(null);
        runner.setAiMonthlyScansUsed(0);
        runner.setAiMonthlyResetDate(null);
        runner.setAiExperiencePhase(PHASE_REGULAR_USER);
        runner.setAiFreeScansRemaining(0);
        runnerRepository.save(runner);
    }

    /**
     * Maps pre-phase rows (welcome + daily limits) onto REGULAR_USER + {@link #USER_FREE_SCANS} pool.
     */
    void migrateLegacyAiQuotaIfNeeded(Runner runner) {
        if (runner.getAiExperiencePhase() != null) {
            return;
        }
        LocalDate today = LocalDate.now();
        int welcome = runner.getAiWelcomeScansRemaining();
        boolean dailyUsedToday = today.equals(runner.getAiDailyLastUsedDate());

        int free;
        if (welcome > 0) {
            free = Math.min(USER_FREE_SCANS, welcome);
        } else if (!dailyUsedToday) {
            free = 1;
        } else {
            free = 0;
        }

        runner.setAiExperiencePhase(PHASE_REGULAR_USER);
        runner.setAiFreeScansRemaining(free);
        runner.setAiWelcomeScansRemaining(0);
        runner.setAiDailyLastUsedDate(null);
        runnerRepository.save(runner);
    }

    private boolean isPro(Runner runner) {
        if (!"PRO".equals(runner.getSubscriptionTier())) {
            return false;
        }
        if (runner.getProExpiresAt() == null) {
            return false;
        }
        if (runner.getProExpiresAt().isBefore(LocalDateTime.now())) {
            runner.setSubscriptionTier("FREE");
            runner.setProExpiresAt(null);
            runnerRepository.save(runner);
            return false;
        }
        return true;
    }

    private void resetMonthlyIfNeeded(Runner runner) {
        LocalDate today = LocalDate.now();
        LocalDate resetDate = runner.getAiMonthlyResetDate();
        if (resetDate == null || !today.isBefore(resetDate)) {
            runner.setAiMonthlyScansUsed(0);
            runner.setAiMonthlyResetDate(today.plusMonths(1).withDayOfMonth(1));
            runnerRepository.save(runner);
        }
    }
}
