package com.hermes.backend;

import java.util.List;

public record PreviewSnapshot(
        String imageUrl,
        String previewImageUrl,
        String source,
        String summary,
        Integer confidence,
        String updatedAt,
        OverlayBounds overlayBounds,
        List<RoutePoint> routePoints,
        List<Integer> elevationSamples,
        Integer totalClimbMeters,
        boolean aiAssisted,
        boolean courseMapDetected
) {}
