package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class WellnessPreferenceService {
    private final RunnerRepository runnerRepository;
    private final ReadinessService readinessService;

    public WellnessPreferenceService(RunnerRepository runnerRepository, ReadinessService readinessService) {
        this.runnerRepository = runnerRepository;
        this.readinessService = readinessService;
    }

    public Map<String, Object> preferences(Runner runner) {
        ReadinessService.MetricSources resolvedSources = resolvedMetricSources(runner);
        return Map.of(
                "metrics", Map.of(
                        "sleep", metricSource(sourceForMetric(runner, runner.getWellnessSleepSource()), isAutoMetric(runner.getWellnessSleepSource()), resolvedSources.sleep()),
                        "hrv", metricSource(sourceForMetric(runner, runner.getWellnessHrvSource()), isAutoMetric(runner.getWellnessHrvSource()), resolvedSources.hrv()),
                        "stress", metricSource(sourceForMetric(runner, runner.getWellnessStressSource()), isAutoMetric(runner.getWellnessStressSource()), resolvedSources.stress()),
                        "body", metricSource(sourceForMetric(runner, runner.getWellnessRestingHrSource()), isAutoMetric(runner.getWellnessRestingHrSource()), resolvedSources.restingHeartRate())
                ),
                "availableSources", List.of("auto", "garmin", "oura", "apple_health", "google_health", "manual")
        );
    }

    public void applyRequestedSources(Runner runner, Map<String, Object> body) {
        applyRequestedSource(body, "sleep", runner::setWellnessSleepSource);
        applyRequestedSource(body, "hrv", runner::setWellnessHrvSource);
        applyRequestedSource(body, "stress", runner::setWellnessStressSource);
        applyRequestedSource(body, "body", runner::setWellnessRestingHrSource);
        applyRequestedSource(body, "restingHeartRate", runner::setWellnessRestingHrSource);
    }

    public Map<String, Object> savePreferences(Runner runner) {
        return preferences(runnerRepository.save(runner));
    }

    private ReadinessService.MetricSources resolvedMetricSources(Runner runner) {
        if (readinessService != null) {
            ReadinessService.MultiSourceReadinessSnapshot snapshot =
                    readinessService.resolveReadinessSnapshot(runner, null, LocalDate.now());
            if (snapshot != null && snapshot.sources() != null) {
                return snapshot.sources();
            }
        }
        String fallbackSource = sourceForMetric(runner, null);
        return new ReadinessService.MetricSources(fallbackSource, fallbackSource, fallbackSource, fallbackSource);
    }

    private boolean isAutoMetric(String storedSource) {
        return storedSource == null || storedSource.isBlank();
    }

    private String sourceForMetric(Runner runner, String storedSource) {
        if (storedSource != null && !storedSource.isBlank()) {
            return storedSource;
        }
        return runner.isGarminWellnessSyncEnabled() ? "GARMIN" : "auto";
    }

    private Map<String, String> metricSource(String source, boolean autoMode, String resolvedSource) {
        String apiSource = autoMode ? "auto" : toApiSource(source);
        String resolvedApiSource = toApiSource(resolvedSource == null || resolvedSource.isBlank() ? source : resolvedSource);
        Map<String, String> metric = new LinkedHashMap<>();
        metric.put("source", apiSource);
        metric.put("mode", autoMode ? "auto" : "preferred");
        metric.put("resolvedSource", resolvedApiSource);
        return metric;
    }

    private void applyRequestedSource(Map<String, Object> body, String metric, java.util.function.Consumer<String> setter) {
        SourcePreferenceRequest request = requestedSource(body, metric);
        if (request.present()) {
            setter.accept(request.source());
        }
    }

    private SourcePreferenceRequest requestedSource(Map<String, Object> body, String metric) {
        if (body == null) return SourcePreferenceRequest.absent();
        Object raw = metricValue(body.get("metrics"), metric);
        if (raw == null) raw = metricValue(body.get("sources"), metric);
        if (raw == null) raw = body.get(metric);
        if (raw == null) return SourcePreferenceRequest.absent();
        return SourcePreferenceRequest.present(normalizeStoredSource(raw));
    }

    private Object metricValue(Object source, String metric) {
        if (!(source instanceof Map<?, ?> sourceMap)) return null;
        Object value = sourceMap.get(metric);
        if (value instanceof Map<?, ?> valueMap) {
            Object nested = valueMap.get("source");
            if (nested == null) nested = valueMap.get("provider");
            return nested;
        }
        return value;
    }

    private String normalizeStoredSource(Object source) {
        String raw = String.valueOf(source == null ? "" : source).trim();
        if (raw.isBlank()) {
            throw new IllegalArgumentException("Wellness source is required.");
        }
        String normalized = raw.toUpperCase(Locale.ROOT).replace('-', '_');
        if ("AUTO".equals(normalized)) return null;
        if ("APPLE".equals(normalized)) return "APPLE_HEALTH";
        if ("GOOGLE".equals(normalized)) return "GOOGLE_HEALTH";
        if ("GARMIN".equals(normalized) || "OURA".equals(normalized) || "APPLE_HEALTH".equals(normalized) || "GOOGLE_HEALTH".equals(normalized) || "MANUAL".equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("Unsupported wellness source: " + raw);
    }

    private String toApiSource(String source) {
        if (source == null || source.isBlank()) return "auto";
        String normalized = source.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if ("APPLE".equals(normalized)) normalized = "APPLE_HEALTH";
        if ("GOOGLE".equals(normalized)) normalized = "GOOGLE_HEALTH";
        return normalized.toLowerCase(Locale.ROOT);
    }

    private record SourcePreferenceRequest(boolean present, String source) {
        static SourcePreferenceRequest absent() {
            return new SourcePreferenceRequest(false, null);
        }

        static SourcePreferenceRequest present(String source) {
            return new SourcePreferenceRequest(true, source);
        }
    }
}
