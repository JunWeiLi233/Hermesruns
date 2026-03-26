package com.hermes.backend;

import java.time.Instant;
import java.util.Map;

public record AdminApiError(
        String error,
        String code,
        Instant timestamp,
        Map<String, Object> details
) {
    public AdminApiError(String error, String code) {
        this(error, code, Instant.now(), Map.of());
    }

    public AdminApiError(String error, String code, Map<String, Object> details) {
        this(error, code, Instant.now(), details == null ? Map.of() : details);
    }
}
