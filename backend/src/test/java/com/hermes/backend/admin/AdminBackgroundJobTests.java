package com.hermes.backend.admin;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AdminBackgroundJobTests {

    @Test
    void prePersist_setsCreatedAtWhenNull() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        assertNull(job.getCreatedAt());
        job.prePersist();
        assertNotNull(job.getCreatedAt());
    }

    @Test
    void prePersist_doesNotOverwriteExistingCreatedAt() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        LocalDateTime fixed = LocalDateTime.of(2024, 1, 15, 10, 0);
        job.setCreatedAt(fixed);
        job.prePersist();
        assertEquals(fixed, job.getCreatedAt());
    }

    @Test
    void prePersist_setsStatusPendingWhenNull() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setStatus(null);
        job.prePersist();
        assertEquals(AdminBackgroundJob.STATUS_PENDING, job.getStatus());
    }

    @Test
    void prePersist_setsStatusPendingWhenBlank() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setStatus("   ");
        job.prePersist();
        assertEquals(AdminBackgroundJob.STATUS_PENDING, job.getStatus());
    }

    @Test
    void prePersist_doesNotOverwriteNonBlankStatus() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.prePersist();
        assertEquals(AdminBackgroundJob.STATUS_RUNNING, job.getStatus());
    }

    @Test
    void statusConstants_haveExpectedValues() {
        assertEquals("PENDING", AdminBackgroundJob.STATUS_PENDING);
        assertEquals("RUNNING", AdminBackgroundJob.STATUS_RUNNING);
        assertEquals("COMPLETED", AdminBackgroundJob.STATUS_COMPLETED);
        assertEquals("FAILED", AdminBackgroundJob.STATUS_FAILED);
    }

    @Test
    void fieldRoundTrip_preservesAllValues() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        LocalDateTime now = LocalDateTime.now();

        job.setJobType("SHOE_SCAN");
        job.setTriggerSource("admin");
        job.setStatus(AdminBackgroundJob.STATUS_COMPLETED);
        job.setCreatedAt(now);
        job.setStartedAt(now.plusSeconds(1));
        job.setFinishedAt(now.plusSeconds(5));
        job.setCreatedByRunnerId(42L);
        job.setCreatedByEmail("test@example.com");
        job.setSummary("10 scanned");
        job.setTotalCount(10);
        job.setSuccessCount(8);
        job.setFailureCount(2);
        job.setDetailsJson("{\"key\":\"val\"}");

        assertEquals("SHOE_SCAN", job.getJobType());
        assertEquals("admin", job.getTriggerSource());
        assertEquals(AdminBackgroundJob.STATUS_COMPLETED, job.getStatus());
        assertEquals(now, job.getCreatedAt());
        assertEquals(now.plusSeconds(1), job.getStartedAt());
        assertEquals(now.plusSeconds(5), job.getFinishedAt());
        assertEquals(42L, job.getCreatedByRunnerId());
        assertEquals("test@example.com", job.getCreatedByEmail());
        assertEquals("10 scanned", job.getSummary());
        assertEquals(10, job.getTotalCount());
        assertEquals(8, job.getSuccessCount());
        assertEquals(2, job.getFailureCount());
        assertEquals("{\"key\":\"val\"}", job.getDetailsJson());
    }
}
