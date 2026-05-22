package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class CourseMapScanWatcher {
    private static final int MAX_MESSAGE_LENGTH = 500;
    private static final int MAX_DETAIL_STRING_LENGTH = 300;

    private final ThreadLocal<ScanSession> currentSession = new ThreadLocal<>();

    public ScanScope watch(String raceId, String action) {
        return watch(raceId, action, null);
    }

    public ScanScope watch(String raceId, String action, Consumer<List<CourseMapScanStep>> onUpdate) {
        ScanSession previous = currentSession.get();
        ScanSession session = new ScanSession(raceId, action, onUpdate);
        currentSession.set(session);
        record("watcher.started", "RUNNING", "Qwen course-map scan watcher attached.", Map.of(
                "raceId", safeText(raceId),
                "action", safeText(action)
        ));
        return new ScanScope(this, previous, session);
    }

    /**
     * Record a step that starts now and stays pending. The stage must later be completed
     * with a matching {@link #completeStep(String, String, String, Map)} call.
     */
    public void beginStep(String stage) {
        beginStep(stage, "");
    }

    /**
     * Record a step that starts now and stays pending.
     * {@code message} is optional (may be empty).
     */
    public void beginStep(String stage, String message) {
        ScanSession session = currentSession.get();
        if (session == null) return;
        if (stage == null || stage.isBlank()) return;
        Instant now = Instant.now();
        session.pendingStarts.put(safeText(stage), now);
        CourseMapScanStep step = CourseMapScanStep.timed(
                safeText(stage),
                "PENDING",
                truncate(safeText(message), MAX_MESSAGE_LENGTH),
                Map.of(),
                now,
                null
        );
        appendStep(session, step);
    }

    /**
     * Complete a previously started step. If no matching PENDING step exists,
     * falls back to an instantaneous record.
     */
    public void completeStep(String stage, String status, String message) {
        completeStep(stage, status, message, Map.of());
    }

    /**
     * Complete a previously started step.
     */
    public void completeStep(String stage, String status, String message, Map<String, Object> details) {
        ScanSession session = currentSession.get();
        if (session == null) return;
        if (stage == null || stage.isBlank()) return;
        String safeStage = safeText(stage);
        Instant startedAt = session.pendingStarts.remove(safeStage);
        Instant now = Instant.now();
        if (startedAt == null) {
            // No matching pending step — record instantaneously
            record(safeStage, status, message, details);
            return;
        }
        CourseMapScanStep step = CourseMapScanStep.timed(
                safeStage,
                normalizeStatus(status),
                truncate(safeText(message), MAX_MESSAGE_LENGTH),
                sanitizeDetails(details),
                startedAt,
                now
        );
        appendStep(session, step);
    }

    /**
     * Record an instantaneous step (start == end). Backward-compatible with existing callers.
     */
    public void record(String stage, String status, String message) {
        record(stage, status, message, Map.of());
    }

    public void record(String stage, String status, String message, Map<String, Object> details) {
        ScanSession session = currentSession.get();
        if (session == null) return;
        Instant now = Instant.now();
        // If there's a pending start for this stage, honour it instead of treating as instantaneous
        Instant startedAt = session.pendingStarts.remove(safeText(stage));
        if (startedAt == null) {
            startedAt = now;
        }
        CourseMapScanStep step = CourseMapScanStep.timed(
                safeText(stage),
                normalizeStatus(status),
                truncate(safeText(message), MAX_MESSAGE_LENGTH),
                sanitizeDetails(details),
                startedAt,
                now
        );
        appendStep(session, step);
    }

    public List<CourseMapScanStep> currentSteps() {
        ScanSession session = currentSession.get();
        return session == null ? List.of() : List.copyOf(session.steps);
    }

    private void appendStep(ScanSession session, CourseMapScanStep step) {
        session.steps.add(step);
        if (session.onUpdate != null) {
            try {
                session.onUpdate.accept(List.copyOf(session.steps));
            } catch (Exception ignored) {
                // Watcher updates must never interrupt the scan they are observing.
            }
        }
    }

    /**
     * Normalize freeform status strings to the canonical set:
     * PENDING, RUNNING, SUCCESS, FAILED, SKIPPED.
     */
    static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "RUNNING";
        String upper = status.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "PENDING" -> "PENDING";
            case "RUNNING" -> "RUNNING";
            case "SUCCESS", "COMPLETED", "OK", "DONE" -> "SUCCESS";
            case "FAILED", "FAILURE", "ERROR" -> "FAILED";
            case "SKIPPED", "SKIP" -> "SKIPPED";
            default -> upper;  // pass through unknown values
        };
    }

    private Map<String, Object> sanitizeDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) return Map.of();
        Map<String, Object> sanitized = new LinkedHashMap<>();
        details.forEach((key, value) -> {
            String safeKey = safeText(key);
            if (safeKey.isBlank()) return;
            sanitized.put(safeKey, sanitizeValue(safeKey, value));
        });
        return sanitized;
    }

    private Object sanitizeValue(String key, Object value) {
        if (value == null) return null;
        String normalizedKey = key.toLowerCase(Locale.ROOT);
        if (normalizedKey.contains("secret")
                || normalizedKey.contains("token")
                || normalizedKey.contains("api")
                || normalizedKey.contains("key")
                || normalizedKey.contains("prompt")) {
            return "[redacted]";
        }
        if (value instanceof Number || value instanceof Boolean) return value;
        return truncate(safeText(String.valueOf(value)), MAX_DETAIL_STRING_LENGTH);
    }

    private String safeText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value == null ? "" : value;
        return value.substring(0, Math.max(0, maxLength - 1)) + "...";
    }

    public static final class ScanScope implements AutoCloseable {
        private final CourseMapScanWatcher watcher;
        private final ScanSession previous;
        private final ScanSession session;
        private boolean closed;

        private ScanScope(CourseMapScanWatcher watcher, ScanSession previous, ScanSession session) {
            this.watcher = watcher;
            this.previous = previous;
            this.session = session;
        }

        @Override
        public void close() {
            if (closed) return;
            closed = true;
            if (watcher.currentSession.get() == session) {
                if (previous == null) {
                    watcher.currentSession.remove();
                } else {
                    watcher.currentSession.set(previous);
                }
            }
        }
    }

    private static final class ScanSession {
        private final List<CourseMapScanStep> steps = new ArrayList<>();
        private final Map<String, Instant> pendingStarts = new LinkedHashMap<>();
        @SuppressWarnings("unused")
        private final String raceId;
        @SuppressWarnings("unused")
        private final String action;
        private final Consumer<List<CourseMapScanStep>> onUpdate;

        private ScanSession(String raceId, String action, Consumer<List<CourseMapScanStep>> onUpdate) {
            this.raceId = raceId;
            this.action = action;
            this.onUpdate = onUpdate;
        }
    }
}
