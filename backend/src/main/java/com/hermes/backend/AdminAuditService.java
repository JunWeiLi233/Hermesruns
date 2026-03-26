package com.hermes.backend;

import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AdminAuditService {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final AdminAuditLogRepository adminAuditLogRepository;

    public AdminAuditService(AdminAuditLogRepository adminAuditLogRepository) {
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    public void log(Runner actor, String action, String targetType, String targetId, String summary) {
        log(actor, action, targetType, targetId, summary, Map.of());
    }

    public void log(Runner actor, String action, String targetType, String targetId, String summary, Map<String, Object> metadata) {
        AdminAuditLog entry = new AdminAuditLog();
        if (actor != null) {
            entry.setActorRunnerId(actor.getId());
            entry.setActorEmail(actor.getEmail());
            entry.setActorRole(actor.getRole());
        }
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setSummary(summary);
        entry.setMetadataJson(writeJson(metadata));
        adminAuditLogRepository.save(entry);
    }

    private String writeJson(Map<String, Object> metadata) {
        try {
            return JSON.writeValueAsString(metadata == null ? Map.of() : new LinkedHashMap<>(metadata));
        } catch (Exception ex) {
            return "{}";
        }
    }
}
