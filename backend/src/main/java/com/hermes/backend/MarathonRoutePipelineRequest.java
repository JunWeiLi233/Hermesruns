package com.hermes.backend;

import java.util.Set;

public record MarathonRoutePipelineRequest(
    String raceId,
    String raceName,
    String city,
    String country,
    String officialWebsite,
    Double latitude,
    Double longitude,
    Double lat,
    Double lng,
    Double distanceKm,
    String imageFilePath
) {
    public static final Set<String> REQUIRED_FIELDS = Set.of(
        "raceId", "raceName", "city", "country", "imageFilePath"
    );

    public MarathonRoutePipelineRequest(
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            String imageFilePath
    ) {
        this(raceId, raceName, city, country, officialWebsite, null, null, null, null, distanceKm, imageFilePath);
    }

    public Double resolvedLatitude() {
        return latitude != null ? latitude : lat;
    }

    public Double resolvedLongitude() {
        return longitude != null ? longitude : lng;
    }
}
