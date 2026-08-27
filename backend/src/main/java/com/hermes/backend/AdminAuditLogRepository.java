package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {
    Page<AdminAuditLog> findByDeletedAtIsNull(Pageable pageable);

    @Query("""
            select log from AdminAuditLog log
            where log.deletedAt is null
              and (
                  lower(log.action) like lower(concat('%', :search, '%'))
                  or lower(log.targetType) like lower(concat('%', :search, '%'))
                  or lower(log.actorEmail) like lower(concat('%', :search, '%'))
              )
            """)
    Page<AdminAuditLog> searchActive(
            @Param("search") String search,
            Pageable pageable
    );

    long countByDeletedAtIsNull();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update AdminAuditLog log set log.deletedAt = :deletedAt where log.deletedAt is null")
    int softDeleteActive(@Param("deletedAt") LocalDateTime deletedAt);

    List<AdminAuditLog> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            LocalDateTime from,
            LocalDateTime to
    );
}
