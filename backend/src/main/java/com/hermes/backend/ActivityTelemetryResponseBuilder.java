package com.hermes.backend;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class ActivityTelemetryResponseBuilder {

    private ActivityTelemetryResponseBuilder() {
    }

    static List<ActivityAnalyticsHelper.SamplePoint> buildAnalyticsSamplePoints(List<Object[]> rows, Activity activity) {
        List<ActivityAnalyticsHelper.SamplePoint> pts = new ArrayList<>(rows == null ? 0 : rows.size());
        if (rows == null || rows.isEmpty()) {
            return pts;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            pts.add(new ActivityAnalyticsHelper.SamplePoint(
                    ((Number) row[0]).doubleValue(),
                    ((Number) row[1]).doubleValue(),
                    row[2] == null ? null : ((Number) row[2]).intValue(),
                    row[3] == null ? null : ((Number) row[3]).doubleValue(),
                    ActivityAnalyticsHelper.resolveElevationForAnalytics(row),
                    row.length > 5 && row[5] != null ? ((Number) row[5]).intValue() : null,
                    row.length > 6 && row[6] != null ? ((Number) row[6]).intValue() : null,
                    row.length > 9 && row[9] != null ? ((Number) row[9]).doubleValue() : null,
                    row.length > 10 && row[10] != null ? ((Number) row[10]).doubleValue() : null
            ));
        }
        ActivityAnalyticsHelper.normalizeSamples(pts, activity);
        return pts;
    }

    static Map<String, Object> buildTelemetrySeries(List<ActivityAnalyticsHelper.SamplePoint> pts) {
        Map<String, Object> series = new LinkedHashMap<>();
        series.put("heartRate", telemetrySeries("heartRate", "bpm", telemetrySamples(pts, "heartRate")));
        series.put("cadence", telemetrySeries("cadence", "spm", telemetrySamples(pts, "cadence")));
        series.put("strideLength", telemetrySeries("strideLength", "m", strideLengthSamples(pts)));
        series.put("elevation", telemetrySeries("elevation", "m", telemetrySamples(pts, "elevation")));
        series.put("groundContactTimeMs", telemetrySeries("groundContactTimeMs", "ms", telemetrySamples(pts, "groundContactTimeMs")));
        series.put("verticalOscillationCm", telemetrySeries("verticalOscillationCm", "cm", telemetrySamples(pts, "verticalOscillationCm")));
        return series;
    }

    static Map<String, Object> estimateTrainingEffect(Activity activity, List<ActivityAnalyticsHelper.SamplePoint> pts) {
        List<ActivityAnalyticsHelper.SamplePoint> hrPoints = pts.stream()
                .filter(point -> point.heartRate() != null && point.heartRate() > 0 && point.elapsedSeconds() != null)
                .toList();
        if (hrPoints.size() < 10) {
            return Map.of(
                    "available", false,
                    "source", "unavailable",
                    "basis", "Insufficient heart-rate stream for training-effect estimate."
            );
        }

        double avgHr = hrPoints.stream().mapToInt(ActivityAnalyticsHelper.SamplePoint::heartRate).average().orElse(0);
        int observedMax = hrPoints.stream().mapToInt(ActivityAnalyticsHelper.SamplePoint::heartRate).max().orElse(0);
        double maxHr = activity.getMaxHeartRate() != null && activity.getMaxHeartRate() > 0
                ? Math.max(activity.getMaxHeartRate(), observedMax)
                : Math.max(190, observedMax);
        int firstSecond = hrPoints.get(0).elapsedSeconds();
        int lastSecond = hrPoints.get(hrPoints.size() - 1).elapsedSeconds();
        double durationMinutes = Math.max(1, (lastSecond - firstSecond) / 60.0);
        double intensity = maxHr > 0 ? avgHr / maxHr : 0;
        long highIntensityCount = hrPoints.stream().filter(point -> point.heartRate() >= maxHr * 0.90).count();
        double highIntensityShare = highIntensityCount / (double) hrPoints.size();

        double aerobic = clampTrainingEffect((durationMinutes / 24.0) * Math.pow(Math.max(0, intensity), 1.7) * 2.8);
        double anaerobic = clampTrainingEffect((highIntensityShare * 5.0) + Math.max(0, intensity - 0.88) * 8.0);

        Map<String, Object> effect = new LinkedHashMap<>();
        effect.put("available", true);
        effect.put("source", "estimated_from_hr_stream");
        effect.put("aerobic", ActivityAnalyticsHelper.round2(aerobic));
        effect.put("anaerobic", ActivityAnalyticsHelper.round2(anaerobic));
        effect.put("averageHeartRate", ActivityAnalyticsHelper.round2(avgHr));
        effect.put("maxHeartRateBasis", ActivityAnalyticsHelper.round2(maxHr));
        effect.put("highIntensityShare", ActivityAnalyticsHelper.round2(highIntensityShare));
        return effect;
    }

    static String normalizeResponseLanguage(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) return "en";
        return acceptLanguage.toLowerCase(Locale.ROOT).contains("zh") ? "zh-CN" : "en";
    }

    static ActivityAnalyticsHelper.PostRunDebrief buildPostRunDebrief(
            Activity activity,
            List<ActivityAnalyticsHelper.SamplePoint> pts,
            String responseLanguage,
            ReadinessService readinessService
    ) {
        if (activity.getRunner() == null) return null;

        java.time.LocalDate runDate = activity.getStartTime() != null
                ? activity.getStartTime().toLocalDate()
                : (activity.getStartDate() != null ? java.time.LocalDate.parse(activity.getStartDate()) : null);

        if (runDate == null) return null;

        ReadinessService.ReadinessDay readiness = readinessService.getDailyReadiness(activity.getRunner(), runDate);
        ActivityAnalyticsHelper.CardiacDrift drift = ActivityAnalyticsHelper.computeCardiacDrift(pts);
        boolean zh = "zh-CN".equals(responseLanguage);

        StringBuilder interpretation = new StringBuilder();
        String nextDayGuidance;

        if (readiness.score() >= 80) {
            interpretation.append(zh ? "\u4f60\u5728\u8f83\u9ad8\u7684\u8dd1\u524d\u72b6\u6001\u4e0b\u5f00\u59cb\u8fd9\u6b21\u8bad\u7ec3\uff08" : "You started this run with high readiness (")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002 " : "%). ");
            if (drift != null && drift.driftPercent() < 5) {
                interpretation.append(zh ? "\u5fc3\u8840\u7ba1\u7cfb\u7edf\u53cd\u9988\u5f88\u597d\uff0c\u5fc3\u7387\u6f02\u79fb\u5f88\u5c0f\u3002" : "Your cardiovascular system responded excellently with minimal drift.");
                nextDayGuidance = zh ? "\u660e\u5929\u53ef\u4ee5\u6309\u8ba1\u5212\u63a8\u8fdb\u8bad\u7ec3\u3002" : "Green light for tomorrow's planned session.";
            } else if (drift != null && drift.driftPercent() > 10) {
                interpretation.append(zh ? "\u4e0d\u8fc7\u5fc3\u7387\u6f02\u79fb\u9ad8\u4e8e\u9884\u671f\uff0c\u8bf4\u660e\u8fd9\u6b21\u8d1f\u8377\u6bd4\u5e73\u65f6\u66f4\u91cd\u3002" : "However, we saw higher than expected cardiac drift, suggesting the effort was more taxing than usual.");
                nextDayGuidance = zh ? "\u660e\u5929\u5efa\u8bae\u7a0d\u5fae\u964d\u4f4e\u5f3a\u5ea6\uff0c\u8ba9\u8eab\u4f53\u5438\u6536\u4eca\u5929\u7684\u8bad\u7ec3\u3002" : "Consider a slightly easier effort tomorrow to absorb today's work.";
            } else {
                interpretation.append(zh ? "\u8eab\u4f53\u5bf9\u8fd9\u6b21\u8bad\u7ec3\u8d1f\u8377\u7684\u627f\u53d7\u7b26\u5408\u9884\u671f\u3002" : "The body handled the workload as expected.");
                nextDayGuidance = zh ? "\u7ee7\u7eed\u6309\u5f53\u524d\u8bad\u7ec3\u5b89\u6392\u63a8\u8fdb\u3002" : "Continue with your scheduled training block.";
            }
        } else if (readiness.score() < 60) {
            interpretation.append(zh ? "\u4f60\u4eca\u5929\u662f\u5728\u660e\u663e\u75b2\u52b3\u4e0b\u5b8c\u6210\u8bad\u7ec3\uff08\u72b6\u6001\uff1a" : "You pushed through significant fatigue today (Readiness: ")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002 " : "%). ");
            if (drift != null && drift.driftPercent() > 8) {
                interpretation.append(zh ? "\u8f83\u9ad8\u7684\u5fc3\u7387\u6f02\u79fb\u786e\u8ba4\u8eab\u4f53\u6b63\u627f\u53d7\u538b\u529b\u3002" : "The high cardiac drift confirms your body is under stress.");
                nextDayGuidance = zh ? "\u660e\u5929\u5efa\u8bae\u5f3a\u5236\u8f7b\u677e\u8dd1\u6216\u4f11\u606f\u3002" : "Mandatory easy day or rest recommended tomorrow.";
            } else {
                interpretation.append(zh ? "\u5c3d\u7ba1\u8dd1\u524d\u72b6\u6001\u504f\u4f4e\uff0c\u4f60\u7684\u6548\u7387\u4ecd\u4fdd\u6301\u5f97\u4e0d\u9519\u3002" : "Impressively, your efficiency held up despite the low readiness signal.");
                nextDayGuidance = zh ? "\u4eca\u665a\u4f18\u5148\u4fdd\u8bc1\u7761\u7720\uff0c\u5e2e\u52a9\u8bad\u7ec3\u8282\u594f\u56de\u5230\u6b63\u8f68\u3002" : "Prioritize sleep tonight to stay on track.";
            }
        } else {
            interpretation.append(zh ? "\u8fd9\u6b21\u662f\u5728\u57fa\u7840\u72b6\u6001\u4e0b\u5b8c\u6210\u7684\u4e00\u6b21\u624e\u5b9e\u8bad\u7ec3\uff08" : "A solid effort on a baseline readiness day (")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002" : "%).");
            nextDayGuidance = zh ? "\u660e\u65e9\u5148\u542c\u8eab\u4f53\u53cd\u9988\uff0c\u518d\u51b3\u5b9a\u662f\u5426\u63a8\u8fdb\u9ad8\u5f3a\u5ea6\u8bad\u7ec3\u3002" : "Listen to your body tomorrow morning before pushing hard.";
        }

        return new ActivityAnalyticsHelper.PostRunDebrief(interpretation.toString(), readiness.score(), nextDayGuidance);
    }

    private static Map<String, Object> telemetrySeries(String key, String unit, List<Map<String, Object>> samples) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("key", key);
        payload.put("unit", unit);
        payload.put("available", !samples.isEmpty());
        payload.put("samples", samples);
        if (samples.isEmpty()) {
            payload.put("unavailableReason", "not_captured");
        }
        return payload;
    }

    private static List<Map<String, Object>> telemetrySamples(List<ActivityAnalyticsHelper.SamplePoint> pts, String metric) {
        List<Map<String, Object>> samples = new ArrayList<>();
        for (ActivityAnalyticsHelper.SamplePoint point : pts) {
            if (point.elapsedSeconds() == null) continue;
            Double value = null;
            if ("heartRate".equals(metric) && point.heartRate() != null && point.heartRate() > 0) {
                value = point.heartRate().doubleValue();
            } else if ("cadence".equals(metric) && point.cadence() != null && point.cadence() > 0) {
                value = point.cadence().doubleValue();
            } else if ("elevation".equals(metric) && point.elevationMeters() != null) {
                value = point.elevationMeters();
            } else if ("groundContactTimeMs".equals(metric) && point.groundContactTimeMs() != null && point.groundContactTimeMs() > 0) {
                value = point.groundContactTimeMs();
            } else if ("verticalOscillationCm".equals(metric) && point.verticalOscillationMm() != null && point.verticalOscillationMm() > 0) {
                value = point.verticalOscillationMm() / 10.0;
            }
            if (value == null || !Double.isFinite(value)) continue;
            samples.add(telemetrySample(point.elapsedSeconds(), value, point.distanceMeters()));
        }
        return samples;
    }

    private static List<Map<String, Object>> strideLengthSamples(List<ActivityAnalyticsHelper.SamplePoint> pts) {
        List<Map<String, Object>> samples = new ArrayList<>();
        for (int index = 1; index < pts.size(); index += 1) {
            ActivityAnalyticsHelper.SamplePoint previous = pts.get(index - 1);
            ActivityAnalyticsHelper.SamplePoint current = pts.get(index);
            if (previous.distanceMeters() == null || current.distanceMeters() == null
                    || previous.elapsedSeconds() == null || current.elapsedSeconds() == null
                    || current.cadence() == null || current.cadence() <= 0) {
                continue;
            }
            double distanceDelta = current.distanceMeters() - previous.distanceMeters();
            double timeDelta = current.elapsedSeconds() - previous.elapsedSeconds();
            if (distanceDelta <= 0 || timeDelta <= 0) continue;
            double speedMetersPerSecond = distanceDelta / timeDelta;
            double strideMeters = speedMetersPerSecond / (current.cadence() / 60.0);
            if (Double.isFinite(strideMeters) && strideMeters > 0 && strideMeters < 3.5) {
                samples.add(telemetrySample(current.elapsedSeconds(), ActivityAnalyticsHelper.round2(strideMeters), current.distanceMeters()));
            }
        }
        return samples;
    }

    private static Map<String, Object> telemetrySample(Integer elapsedSeconds, Double value, Double distanceMeters) {
        Map<String, Object> sample = new LinkedHashMap<>();
        sample.put("t", elapsedSeconds);
        sample.put("value", ActivityAnalyticsHelper.round2(value));
        if (distanceMeters != null && Double.isFinite(distanceMeters)) {
            sample.put("distanceKm", ActivityAnalyticsHelper.round2(distanceMeters / 1000.0));
        }
        return sample;
    }

    private static double clampTrainingEffect(double value) {
        if (!Double.isFinite(value)) return 0;
        return Math.max(0, Math.min(5, value));
    }
}
