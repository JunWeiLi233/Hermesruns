package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CourseMapScanStep(
        String at,
        String stage,
        String status,
        String message,
        Map<String, Object> details,
        Instant startedAt,
        Instant completedAt
) {
    /**
     * Convenience constructor that preserves the existing {@code (at, stage, status, message, details)} shape
     * while deriving {@code startedAt} and {@code completedAt} from {@code at} when possible.
     */
    public static CourseMapScanStep of(String at, String stage, String status, String message, Map<String, Object> details) {
        Instant parsed = parseInstant(at);
        return new CourseMapScanStep(at, stage, status, message, details, parsed, parsed);
    }

    /**
     * Create a step with explicit start/end timing. {@code at} is derived from {@code completedAt}
     * (or {@code startedAt} when incomplete) for backward-compatible serialization.
     */
    public static CourseMapScanStep timed(
            String stage,
            String status,
            String message,
            Map<String, Object> details,
            Instant startedAt,
            Instant completedAt
    ) {
        Instant ref = completedAt != null ? completedAt : startedAt;
        String at = ref == null ? "" : ref.toString();
        return new CourseMapScanStep(at, stage, status, message, details, startedAt, completedAt);
    }

    /**
     * Duration in milliseconds. 0 when either timestamp is absent.
     */
    @JsonIgnore
    public long durationMs() {
        if (startedAt == null || completedAt == null) return 0;
        return Math.max(0, completedAt.toEpochMilli() - startedAt.toEpochMilli());
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            return null;
        }
    }
}
