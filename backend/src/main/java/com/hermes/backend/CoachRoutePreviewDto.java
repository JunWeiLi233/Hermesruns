package com.hermes.backend;

public record CoachRoutePreviewDto(
        String path,
        double startX,
        double startY,
        double finishX,
        double finishY
) {}
