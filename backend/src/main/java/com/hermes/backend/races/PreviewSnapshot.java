package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
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
        boolean courseMapDetected,
        Boolean sourceAvailable,
        Boolean alignmentAccepted
) {
    public PreviewSnapshot(String imageUrl, String previewImageUrl, String source, String summary,
            Integer confidence, String updatedAt, OverlayBounds overlayBounds, List<RoutePoint> routePoints,
            List<Integer> elevationSamples, Integer totalClimbMeters, boolean aiAssisted, boolean courseMapDetected) {
        this(imageUrl, previewImageUrl, source, summary, confidence, updatedAt, overlayBounds, routePoints,
                elevationSamples, totalClimbMeters, aiAssisted, courseMapDetected, null, null);
    }
}
