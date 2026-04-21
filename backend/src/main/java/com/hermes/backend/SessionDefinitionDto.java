package com.hermes.backend;

import java.util.List;

public record SessionDefinitionDto(
        String sessionType,
        String title,
        String emphasis,
        int durationMinutes,
        int targetRpe,
        boolean optional,
        List<BlockDto> blocks
) {}
