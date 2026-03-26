package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {
    Page<AdminAuditLog> findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCaseOrActorEmailContainingIgnoreCase(
            String action,
            String targetType,
            String actorEmail,
            Pageable pageable
    );
}
