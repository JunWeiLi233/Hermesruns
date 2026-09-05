package com.hermes.backend.coaching;

public record CoachRoutePreviewDto(
        String path,
        double startX,
        double startY,
        double finishX,
        double finishY
) {}
