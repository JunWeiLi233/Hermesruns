package com.hermes.backend.races;

public record RaceCourseMapAdminDetail(
        String raceId,
        String raceName,
        String city,
        String country,
        String officialWebsite,
        Double latitude,
        Double longitude,
        Double distanceKm,
        PreviewSnapshot live,
        PreviewSnapshot pendingPreview,
        PreviewSnapshot currentLivePreview
) {}
