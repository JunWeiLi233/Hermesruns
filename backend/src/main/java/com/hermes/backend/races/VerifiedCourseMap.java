package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.List;

/** Source-bound course geometry shared by exact-source lookup and preview generation. */
record VerifiedCourseMap(String source, String summary, String sourceUrl, List<RoutePoint> routePoints,
                         List<Integer> elevationSamples, Integer totalClimbMeters) {
    RaceCourseMapResult preview(String imageUrl) {
        var bounds = new RaceCourseMapGeometryService().boundsFromRoute(routePoints);
        return new RaceCourseMapResult(imageUrl, source, true, source.startsWith("reviewed-source-map:") ? 85 : 90,
                summary, bounds, routePoints, elevationSamples, totalClimbMeters, false);
    }
}
