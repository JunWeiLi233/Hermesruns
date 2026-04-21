package com.hermes.backend;

import java.util.List;

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
        boolean aiAssisted
) {}
