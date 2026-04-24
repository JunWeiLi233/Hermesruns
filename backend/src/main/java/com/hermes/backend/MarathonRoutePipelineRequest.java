package com.hermes.backend;

import java.util.Set;

public record MarathonRoutePipelineRequest(
    String raceId,
    String raceName,
    String city,
    String country,
    String officialWebsite,
    Double distanceKm,
    String imageFilePath
) {
    public static final Set<String> REQUIRED_FIELDS = Set.of(
        "raceId", "raceName", "city", "country", "imageFilePath"
    );
}
