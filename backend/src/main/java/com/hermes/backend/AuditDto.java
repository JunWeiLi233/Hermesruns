package com.hermes.backend;

public record AuditDto(
        Long id,
        String createdAt,
        String actorEmail,
        String actorRole,
        String action,
        String targetType,
        String targetId,
        String summary,
        String metadataJson
) {
}
