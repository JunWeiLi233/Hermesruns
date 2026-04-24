package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LocalConsoleErrorReport(
        String kind,
        String severity,
        String message,
        String stack,
        String route,
        String pageUrl,
        String sourceUrl,
        String assetUrl,
        String userAgent,
        String sessionId,
        Integer count
) {
    public LocalConsoleErrorReport {
        kind = normalize(kind, 80);
        severity = normalize(severity, 24);
        message = normalize(message, 1500);
        stack = normalize(stack, 6000);
        route = normalize(route, 240);
        pageUrl = normalize(pageUrl, 1200);
        sourceUrl = normalize(sourceUrl, 1200);
        assetUrl = normalize(assetUrl, 1200);
        userAgent = normalize(userAgent, 1000);
        sessionId = normalize(sessionId, 120);
        count = count == null || count < 1 ? 1 : Math.min(count, 1000);
    }

    private static String normalize(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim().replace("\u0000", "");
        if (trimmed.isBlank()) return null;
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
