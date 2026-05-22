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

public interface AdminBackgroundJobRepository extends JpaRepository<AdminBackgroundJob, Long> {
    Page<AdminBackgroundJob> findByJobTypeContainingIgnoreCaseAndStatusContainingIgnoreCase(String jobType, String status, Pageable pageable);
    List<AdminBackgroundJob> findByJobTypeInAndStatus(List<String> jobTypes, String status);
    List<AdminBackgroundJob> findTop10ByStatusOrderByCreatedAtDesc(String status);
    List<AdminBackgroundJob> findTop10ByStatusInOrderByCreatedAtDesc(List<String> statuses);
    List<AdminBackgroundJob> findTop5ByJobTypeInOrderByCreatedAtDesc(List<String> jobTypes);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("""
            update AdminBackgroundJob job
            set job.status = :runningStatus,
                job.startedAt = :startedAt,
                job.totalCount = :totalCount
            where job.id = :jobId
              and job.status = :pendingStatus
              and job.jobType in :jobTypes
              and not exists (
                  select runningJob.id
                  from AdminBackgroundJob runningJob
                  where runningJob.jobType in :jobTypes
                    and runningJob.status = :runningStatus
              )
              and not exists (
                  select earlierJob.id
                  from AdminBackgroundJob earlierJob
                  where earlierJob.jobType in :jobTypes
                    and earlierJob.status = :pendingStatus
                    and (
                        earlierJob.createdAt < job.createdAt
                        or (earlierJob.createdAt = job.createdAt and earlierJob.id < job.id)
                    )
              )
            """)
    int claimCourseMapScanTurn(
            @Param("jobId") Long jobId,
            @Param("jobTypes") List<String> jobTypes,
            @Param("pendingStatus") String pendingStatus,
            @Param("runningStatus") String runningStatus,
            @Param("startedAt") LocalDateTime startedAt,
            @Param("totalCount") int totalCount);
}
