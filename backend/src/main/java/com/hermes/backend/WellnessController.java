package com.hermes.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/wellness")
public class WellnessController {

    private final AppleHealthImportService appleHealthImportService;
    private final GoogleHealthImportService googleHealthImportService;
    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ReadinessService readinessService;

    @Autowired
    public WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService,
            AuthService authService,
            RunnerRepository runnerRepository,
            ReadinessService readinessService
    ) {
        this.appleHealthImportService = appleHealthImportService;
        this.googleHealthImportService = googleHealthImportService;
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.readinessService = readinessService;
    }

    WellnessController(
            AppleHealthImportService appleHealthImportService,
            GoogleHealthImportService googleHealthImportService,
            AuthService authService,
            RunnerRepository runnerRepository
    ) {
        this(appleHealthImportService, googleHealthImportService, authService, runnerRepository, null);
    }

    @GetMapping("/source-preferences")
    public ResponseEntity<?> getSourcePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional == null || runnerOptional.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in required."));
        }

        Runner runner = runnerOptional.get();
        return ResponseEntity.ok(sourcePreferencesBody(runner));
    }

    @PutMapping("/source-preferences")
    public ResponseEntity<?> updateSourcePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional == null || runnerOptional.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in required."));
        }

        Runner runner = runnerOptional.get();
        try {
            applyRequestedSource(body, "sleep", runner::setWellnessSleepSource);
            applyRequestedSource(body, "hrv", runner::setWellnessHrvSource);
            applyRequestedSource(body, "stress", runner::setWellnessStressSource);
            applyRequestedSource(body, "body", runner::setWellnessRestingHrSource);
            applyRequestedSource(body, "restingHeartRate", runner::setWellnessRestingHrSource);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        }

        Runner saved = runnerRepository.save(runner);
        return ResponseEntity.ok(sourcePreferencesBody(saved));
    }

    @PostMapping("/apple-health/import")
    public ResponseEntity<?> importAppleHealth(@AuthenticationPrincipal Runner runner, @RequestBody List<Map<String, Object>> dataPoints) {
        if (runner == null) return ResponseEntity.status(401).build();
        boolean started = appleHealthImportService.importWellnessData(runner, dataPoints);
        if (started) {
            return ResponseEntity.accepted().body(Map.of("message", "Apple Health import started."));
        } else {
            return ResponseEntity.status(429).body(Map.of("message", "Import already in progress."));
        }
    }

    @GetMapping("/apple-health/status")
    public ResponseEntity<?> getAppleHealthStatus(@AuthenticationPrincipal Runner runner) {
        if (runner == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(appleHealthImportService.getStatus(runner.getId()));
    }

    @PostMapping("/google-health/import")
    public ResponseEntity<?> importGoogleHealth(@AuthenticationPrincipal Runner runner, @RequestBody List<Map<String, Object>> dataPoints) {
        if (runner == null) return ResponseEntity.status(401).build();
        boolean started = googleHealthImportService.importWellnessData(runner, dataPoints);
        if (started) {
            return ResponseEntity.accepted().body(Map.of("message", "Google Health Connect import started."));
        } else {
            return ResponseEntity.status(429).body(Map.of("message", "Import already in progress."));
        }
    }

    @GetMapping("/google-health/status")
    public ResponseEntity<?> getGoogleHealthStatus(@AuthenticationPrincipal Runner runner) {
        if (runner == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(googleHealthImportService.getStatus(runner.getId()));
    }

    private Map<String, Object> sourcePreferencesBody(Runner runner) {
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
