package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminBackgroundJobServiceTests {

    @Test
    void markCompletedTruncatesSummaryToFitDefaultVarcharColumn() {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob job = new AdminBackgroundJob();
        String longSummary = "Hermes accepted this stylized upload as a city-level course-map match for a standard road marathon in Chicago. "
                + "The upload is treated as a city-level map reference, not a distance-accurate route overlay. "
                + "Qwen was skipped for this stylized/raster map because the image can only support a city-level match.";

        service.markCompleted(job, 1, 0, longSummary, Map.of("raceId", "chicago-marathon"));

        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_COMPLETED);
        assertThat(job.getSummary()).hasSizeLessThanOrEqualTo(240);
        assertThat(job.getSummary()).endsWith("...");
    }

    @Test
    void recoverOrphanedCourseMapScanJobsFailsStaleRunningCourseMapJobs() {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.setStartedAt(LocalDateTime.now().minusHours(3));
        job.setTotalCount(1);
        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_RUNNING)).thenReturn(List.of(job));
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);

        service.recoverOrphanedCourseMapScanJobs();

        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_FAILED);
        assertThat(job.getSuccessCount()).isZero();
        assertThat(job.getFailureCount()).isEqualTo(1);
        assertThat(job.getFinishedAt()).isNotNull();
        assertThat(job.getSummary()).contains("interrupted by a Hermes restart");
        verify(repository).save(job);
    }

    @Test
    void recoverOrphanedCourseMapScanJobsFailsFreshRunningCourseMapJobsFromPreviousProcess() {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.setStartedAt(LocalDateTime.now());
        job.setTotalCount(1);
        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_RUNNING)).thenReturn(List.of(job));
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);

        service.recoverOrphanedCourseMapScanJobs();

        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_FAILED);
        assertThat(job.getFinishedAt()).isNotNull();
        assertThat(job.getSummary()).contains("interrupted by a Hermes restart");
        verify(repository).save(job);
    }

    @Test
    void recoverOrphanedCourseMapScanJobsFailsPendingCourseMapJobsFromPreviousProcess() {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("COURSE_MAP_PREVIEW_UPLOAD");
        job.setStatus(AdminBackgroundJob.STATUS_PENDING);
        job.setCreatedAt(LocalDateTime.now().minusMinutes(3));
        job.setTotalCount(1);
        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_RUNNING)).thenReturn(List.of());
        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_PENDING)).thenReturn(List.of(job));
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);

        service.recoverOrphanedCourseMapScanJobs();

        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_FAILED);
        assertThat(job.getFinishedAt()).isNotNull();
        assertThat(job.getSummary()).contains("queued before this Hermes worker started");
        verify(repository).save(job);
    }

    @Test
    void runCourseMapScanAsyncProcessesCourseMapsOneAtATimeInFifoOrder() throws Exception {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob firstJob = new AdminBackgroundJob();
        AdminBackgroundJob secondJob = new AdminBackgroundJob();
        CountDownLatch firstStarted = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        List<String> order = new CopyOnWriteArrayList<>();

        try {
            service.runCourseMapScanAsync(firstJob, 1, () -> {
                order.add("first-started");
                firstStarted.countDown();
                try {
                    if (!releaseFirst.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to release first course-map scan");
                    }
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
                order.add("first-finished");
            });
            service.runCourseMapScanAsync(secondJob, 1, () -> {
                order.add("second-started");
                secondStarted.countDown();
            });

            assertThat(firstStarted.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(firstJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_RUNNING);
            assertThat(secondJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_PENDING);
            assertThat(secondStarted.await(200, TimeUnit.MILLISECONDS))
                    .as("second course-map scan must wait for the first FIFO slot")
                    .isFalse();

            releaseFirst.countDown();

            assertThat(secondStarted.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(order).containsExactly("first-started", "first-finished", "second-started");
        } finally {
            releaseFirst.countDown();
            service.shutdown();
        }
    }

    @Test
    void runCourseMapScanAsyncFailsScanThatExitsWithoutTerminalStatus() throws Exception {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob job = new AdminBackgroundJob();
        CountDownLatch taskFinished = new CountDownLatch(1);

        try {
            service.runCourseMapScanAsync(job, 1, taskFinished::countDown);

            assertThat(taskFinished.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(awaitJobStatus(job, AdminBackgroundJob.STATUS_FAILED, 2)).isTrue();
            assertThat(job.getFailureCount()).isEqualTo(1);
            assertThat(job.getFinishedAt()).isNotNull();
            assertThat(job.getSummary()).contains("without recording a terminal status");
        } finally {
            service.shutdown();
        }
    }

    @Test
    void runCourseMapScanAsyncSerializesCourseMapScansAcrossServiceInstances() throws Exception {
        AdminBackgroundJobRepository firstRepository = mock(AdminBackgroundJobRepository.class);
        AdminBackgroundJobRepository secondRepository = mock(AdminBackgroundJobRepository.class);
        when(firstRepository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(secondRepository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminBackgroundJobService firstService = new AdminBackgroundJobService(firstRepository);
        AdminBackgroundJobService secondService = new AdminBackgroundJobService(secondRepository);
        AdminBackgroundJob firstJob = new AdminBackgroundJob();
        AdminBackgroundJob secondJob = new AdminBackgroundJob();
        firstJob.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        secondJob.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        CountDownLatch firstStarted = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        List<String> order = new CopyOnWriteArrayList<>();

        try {
            firstService.runCourseMapScanAsync(firstJob, 1, () -> {
                order.add("first-started");
                firstStarted.countDown();
                try {
                    if (!releaseFirst.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to release first course-map scan");
                    }
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
                order.add("first-finished");
            });

            assertThat(firstStarted.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(firstJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_RUNNING);

            secondService.runCourseMapScanAsync(secondJob, 1, () -> {
                order.add("second-started");
                secondStarted.countDown();
            });

            assertThat(secondStarted.await(200, TimeUnit.MILLISECONDS))
                    .as("course-map scan FIFO must be shared across service owners")
                    .isFalse();
            assertThat(secondJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_PENDING);

            releaseFirst.countDown();

            assertThat(secondStarted.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(order).containsExactly("first-started", "first-finished", "second-started");
        } finally {
            releaseFirst.countDown();
            firstService.shutdown();
            secondService.shutdown();
        }
    }

    @Test
    void runCourseMapScanAsyncRecoversRepositoryRunningScanWithoutLiveWorker() throws Exception {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob runningJob = new AdminBackgroundJob();
        AdminBackgroundJob queuedJob = new AdminBackgroundJob();
        ReflectionTestUtils.setField(runningJob, "id", 101L);
        ReflectionTestUtils.setField(queuedJob, "id", 102L);
        runningJob.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        runningJob.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        queuedJob.setJobType("COURSE_MAP_PREVIEW_REANALYZE");
        AtomicBoolean laneBusy = new AtomicBoolean(true);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch releaseQueued = new CountDownLatch(1);

        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_RUNNING)).thenAnswer(invocation -> laneBusy.get() ? List.of(runningJob) : List.of());
        when(repository.claimCourseMapScanTurn(
                eq(102L),
                eq(List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD")),
                eq(AdminBackgroundJob.STATUS_PENDING),
                eq(AdminBackgroundJob.STATUS_RUNNING),
                any(LocalDateTime.class),
                eq(1))).thenReturn(1);

        try {
            service.runCourseMapScanAsync(queuedJob, 1, () -> {
                started.countDown();
                try {
                    if (!releaseQueued.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to release queued course-map scan");
                    }
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
            });

            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(runningJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_FAILED);
            assertThat(runningJob.getSummary()).contains("active worker");
            assertThat(queuedJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_RUNNING);
        } finally {
            laneBusy.set(false);
            releaseQueued.countDown();
            service.shutdown();
        }
    }

    @Test
    void runCourseMapScanAsyncRecoversOlderPendingScanWithoutLiveWorker() throws Exception {
        AdminBackgroundJobRepository repository = mock(AdminBackgroundJobRepository.class);
        when(repository.save(any(AdminBackgroundJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminBackgroundJobService service = new AdminBackgroundJobService(repository);
        AdminBackgroundJob orphanedPendingJob = new AdminBackgroundJob();
        AdminBackgroundJob queuedJob = new AdminBackgroundJob();
        ReflectionTestUtils.setField(orphanedPendingJob, "id", 101L);
        ReflectionTestUtils.setField(queuedJob, "id", 102L);
        orphanedPendingJob.setJobType("COURSE_MAP_PREVIEW_UPLOAD");
        orphanedPendingJob.setStatus(AdminBackgroundJob.STATUS_PENDING);
        queuedJob.setJobType("COURSE_MAP_PREVIEW_UPLOAD");
        queuedJob.setStatus(AdminBackgroundJob.STATUS_PENDING);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch releaseQueued = new CountDownLatch(1);

        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_RUNNING)).thenReturn(List.of());
        when(repository.findByJobTypeInAndStatus(
                List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD"),
                AdminBackgroundJob.STATUS_PENDING)).thenReturn(List.of(orphanedPendingJob, queuedJob));
        when(repository.claimCourseMapScanTurn(
                eq(102L),
                eq(List.of("COURSE_MAP_PREVIEW_SCAN", "COURSE_MAP_PREVIEW_REANALYZE", "COURSE_MAP_PREVIEW_UPLOAD")),
                eq(AdminBackgroundJob.STATUS_PENDING),
                eq(AdminBackgroundJob.STATUS_RUNNING),
                any(LocalDateTime.class),
                eq(1))).thenReturn(1);

        try {
            service.runCourseMapScanAsync(queuedJob, 1, () -> {
                started.countDown();
                try {
                    if (!releaseQueued.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to release queued course-map scan");
                    }
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
            });

            assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(orphanedPendingJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_FAILED);
            assertThat(orphanedPendingJob.getSummary()).contains("queued before this Hermes worker started");
            assertThat(queuedJob.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_RUNNING);
        } finally {
            releaseQueued.countDown();
            service.shutdown();
        }
    }

    private boolean awaitJobStatus(AdminBackgroundJob job, String status, long timeoutSeconds) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
        while (System.nanoTime() < deadline) {
            if (status.equals(job.getStatus())) {
                return true;
            }
            TimeUnit.MILLISECONDS.sleep(25);
        }
        return status.equals(job.getStatus());
    }
}
