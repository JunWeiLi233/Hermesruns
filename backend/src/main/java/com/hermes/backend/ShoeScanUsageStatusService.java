package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ShoeScanUsageStatusService {
    private final AiUsageService aiUsageService;
    private final QuotaService quotaService;

    public ShoeScanUsageStatusService(AiUsageService aiUsageService, QuotaService quotaService) {
        this.aiUsageService = aiUsageService;
        this.quotaService = quotaService;
    }

    public Map<String, Object> buildStatus(Runner runner) {
        Map<String, Object> status = new LinkedHashMap<>(aiUsageService.getUsageStatus(runner));
        if (runner == null || Boolean.TRUE.equals(status.get("unlimited")) || Boolean.TRUE.equals(status.get("admin"))) {
            return status;
        }

        Map<String, Object> quotaStatus = quotaService.getQuotaStatus(runner);
        Object shoeScanRaw = quotaStatus.get("shoeScan");
        if (!(shoeScanRaw instanceof Map<?, ?> shoeScan)) {
            return status;
        }

        int featureUsed = intValue(shoeScan.get("used"), 0);
        int featureLimit = intValue(shoeScan.get("limit"), 0);
        int featureRemaining = intValue(shoeScan.get("remaining"), Math.max(0, featureLimit - featureUsed));
        int dailyRemaining = intValue(status.get("scansRemaining"), featureRemaining);

        status.put("quotaType", "user_free");
        status.put("scansRemaining", Math.max(0, Math.min(featureRemaining, dailyRemaining)));
        status.put("monthlyLimit", featureLimit);
        status.put("monthlyUsed", featureUsed);
        status.put("userFreeTotal", featureLimit);
        status.put("featureQuotaLimit", featureLimit);
        status.put("featureQuotaUsed", featureUsed);
        status.put("featureQuotaRemaining", featureRemaining);
        return status;
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String stringValue) {
            try {
                return Integer.parseInt(stringValue.trim());
            } catch (Exception ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
