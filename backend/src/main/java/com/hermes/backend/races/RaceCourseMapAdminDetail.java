package com.hermes.backend.races;

public record RaceCourseMapAdminDetail(
        String raceId,
        String raceName,
        String city,
        String country,
        PreviewSnapshot live,
        PreviewSnapshot pendingPreview,
        PreviewSnapshot currentLivePreview
) {}
