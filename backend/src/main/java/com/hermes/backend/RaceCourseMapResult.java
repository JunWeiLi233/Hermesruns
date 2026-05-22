package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RaceCourseMapResult(
        String imageUrl,
        String source,
        boolean courseMapDetected,
        int confidence,
        String summary,
        OverlayBounds overlayBounds,
        List<RoutePoint> routePoints,
        List<Integer> elevationSamples,
        Integer totalClimbMeters,
        boolean aiAssisted,
        List<CourseMapScanStep> scanSteps
) {
    /** Convenience constructor for callers that do not populate scan steps (backward compat). */
    public RaceCourseMapResult(
            String imageUrl,
            String source,
            boolean courseMapDetected,
            int confidence,
            String summary,
            OverlayBounds overlayBounds,
            List<RoutePoint> routePoints,
            List<Integer> elevationSamples,
            Integer totalClimbMeters,
            boolean aiAssisted
    ) {
        this(imageUrl, source, courseMapDetected, confidence, summary, overlayBounds, routePoints, elevationSamples, totalClimbMeters, aiAssisted, null);
    }
}
