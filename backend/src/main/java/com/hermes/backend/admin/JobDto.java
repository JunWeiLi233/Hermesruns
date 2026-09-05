package com.hermes.backend.admin;

public record JobDto(
        Long id,
        String jobType,
        String triggerSource,
        String status,
        String summary,
        String createdAt,
        String startedAt,
        String finishedAt,
        String createdByEmail,
        int totalCount,
        int successCount,
        int failureCount,
        String detailsJson
) {
}
