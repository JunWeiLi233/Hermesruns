package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-background-job-repository-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
@Transactional
class AdminBackgroundJobRepositoryTests {
    private static final List<String> COURSE_MAP_SCAN_TYPES = List.of(
            "COURSE_MAP_PREVIEW_SCAN",
            "COURSE_MAP_PREVIEW_REANALYZE",
            "COURSE_MAP_PREVIEW_UPLOAD");

    @Autowired
    private AdminBackgroundJobRepository repository;

    @BeforeEach
    void clearData() {
        repository.deleteAll();
    }

    @Test
    void claimCourseMapScanTurnStartsTheOldestPendingCourseMapScan() {
        AdminBackgroundJob older = saveCourseMapJob("COURSE_MAP_PREVIEW_REANALYZE", LocalDateTime.now().minusMinutes(2));
        AdminBackgroundJob newer = saveCourseMapJob("COURSE_MAP_PREVIEW_UPLOAD", LocalDateTime.now().minusMinutes(1));

        int newerClaim = repository.claimCourseMapScanTurn(
                newer.getId(),
                COURSE_MAP_SCAN_TYPES,
                AdminBackgroundJob.STATUS_PENDING,
                AdminBackgroundJob.STATUS_RUNNING,
                LocalDateTime.now(),
                1);
        int olderClaim = repository.claimCourseMapScanTurn(
                older.getId(),
                COURSE_MAP_SCAN_TYPES,
                AdminBackgroundJob.STATUS_PENDING,
                AdminBackgroundJob.STATUS_RUNNING,
                LocalDateTime.now(),
                1);

        AdminBackgroundJob olderAfterClaim = repository.findById(older.getId()).orElseThrow();
        AdminBackgroundJob newerAfterClaim = repository.findById(newer.getId()).orElseThrow();
        assertThat(newerClaim).isZero();
        assertThat(olderClaim).isEqualTo(1);
        assertThat(olderAfterClaim.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_RUNNING);
        assertThat(newerAfterClaim.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_PENDING);
    }

    private AdminBackgroundJob saveCourseMapJob(String type, LocalDateTime createdAt) {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType(type);
        job.setStatus(AdminBackgroundJob.STATUS_PENDING);
        job.setCreatedAt(createdAt);
        job.setSummary("Queued course-map scan.");
        return repository.saveAndFlush(job);
    }
}
