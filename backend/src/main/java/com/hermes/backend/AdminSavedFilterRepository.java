package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdminSavedFilterRepository extends JpaRepository<AdminSavedFilter, Long> {
    List<AdminSavedFilter> findByOwnerRunnerIdAndScopeOrderByUpdatedAtDesc(Long ownerRunnerId, String scope);
}
