package com.hermes.backend.admin;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminSavedFilterRepository extends JpaRepository<AdminSavedFilter, Long> {
    List<AdminSavedFilter> findByOwnerRunnerIdAndScopeOrderByUpdatedAtDesc(Long ownerRunnerId, String scope);
}
