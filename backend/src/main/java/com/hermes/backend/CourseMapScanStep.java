package com.hermes.backend;

import java.util.Map;

public record CourseMapScanStep(
        String at,
        String stage,
        String status,
        String message,
        Map<String, Object> details
) {}
