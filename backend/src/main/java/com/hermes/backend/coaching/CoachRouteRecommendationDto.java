package com.hermes.backend.coaching;

import java.util.List;

public record CoachRouteRecommendationDto(
        String zoneKey,
        String confidence,
        Double targetDistanceKm,
        Double representativeDistanceKm,
        int activityCount,
        CoachRoutePreviewDto preview,
        List<CoachRouteWaypointDto> waypoints
) {}
