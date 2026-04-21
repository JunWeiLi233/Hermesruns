package com.hermes.backend;

public record CoachRouteRecommendationDto(
        String zoneKey,
        String confidence,
        Double targetDistanceKm,
        Double representativeDistanceKm,
        int activityCount,
        CoachRoutePreviewDto preview
) {}
