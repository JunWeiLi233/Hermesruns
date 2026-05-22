package com.hermes.backend;

public record StrengthAssignmentDto(
        String sessionType,
        String title,
        String emphasis,
        int durationMinutes,
        int targetRpe,
        boolean optional,
        boolean quietCompatible,
        String placementReasonCode,
        String cautionCode
) {}
