package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdminBackgroundJobRepository extends JpaRepository<AdminBackgroundJob, Long> {
    Page<AdminBackgroundJob> findByJobTypeContainingIgnoreCaseAndStatusContainingIgnoreCase(String jobType, String status, Pageable pageable);
    List<AdminBackgroundJob> findTop10ByStatusOrderByCreatedAtDesc(String status);
    List<AdminBackgroundJob> findTop10ByStatusInOrderByCreatedAtDesc(List<String> statuses);
    List<AdminBackgroundJob> findTop5ByJobTypeInOrderByCreatedAtDesc(List<String> jobTypes);
}
