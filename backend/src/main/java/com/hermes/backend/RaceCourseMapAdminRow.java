package com.hermes.backend;

public record RaceCourseMapAdminRow(
        String raceId,
        String raceName,
        String city,
        String country,
        PreviewSnapshot live,
        PreviewSnapshot pendingPreview,
        String updatedAt,
        boolean hasPendingPreview
) {}
