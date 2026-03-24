package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiUsageService {

    private static final int WELCOME_SCANS = 5;
    private static final int FREE_DAILY_LIMIT = 1;
    private static final int PRO_MONTHLY_LIMIT = 50;

    private final RunnerRepository runnerRepository;

    public AiUsageService(RunnerRepository runnerRepository) {
        this.runnerRepository = runnerRepository;
    }

    /**
     * Check if a runner can perform an AI scan right now.
     * Returns null if allowed, or an error message if blocked.
     */
    public String checkQuota(Runner runner) {
        if ("ADMIN".equals(runner.getRole())) {
            return null; // admins are unlimited
        }

        if (isPro(runner)) {
            resetMonthlyIfNeeded(runner);
            if (runner.getAiMonthlyScansUsed() >= PRO_MONTHLY_LIMIT) {
                return "PRO_MONTHLY_LIMIT";
            }
            return null;
        }

        // Free tier: welcome scans first, then daily limit
        if (runner.getAiWelcomeScansRemaining() > 0) {
            return null;
        }

        LocalDate today = LocalDate.now();
        if (today.equals(runner.getAiDailyLastUsedDate())) {
            return "FREE_DAILY_LIMIT";
        }

        return null;
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
        } else if (runner.getAiWelcomeScansRemaining() > 0) {
            runner.setAiWelcomeScansRemaining(runner.getAiWelcomeScansRemaining() - 1);
        } else {
            runner.setAiDailyLastUsedDate(LocalDate.now());
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
        } else {
            int welcomeRemaining = runner.getAiWelcomeScansRemaining();
            if (welcomeRemaining > 0) {
                status.put("unlimited", false);
                status.put("scansRemaining", welcomeRemaining);
                status.put("quotaType", "welcome");
                status.put("welcomeTotal", WELCOME_SCANS);
            } else {
                LocalDate today = LocalDate.now();
                boolean usedToday = today.equals(runner.getAiDailyLastUsedDate());
                status.put("unlimited", false);
                status.put("scansRemaining", usedToday ? 0 : FREE_DAILY_LIMIT);
                status.put("quotaType", "daily");
                status.put("dailyLimit", FREE_DAILY_LIMIT);
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

        // Extend from current expiry if still active, otherwise from now
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
            // Pro expired — downgrade
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
