package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiUsageServiceTests {

    @Mock
    private RunnerRepository runnerRepository;

    private AiUsageService service;

    @BeforeEach
    void setUp() {
        // perRunnerDailyLimit=3, projectDailyLimit=100, projectDailyReserve=0
        service = new AiUsageService(runnerRepository, 3, 100, 0);
    }

    private Runner freshRunner() {
        Runner runner = new Runner();
        runner.setId(1L);
        runner.setEmail("test@hermes.com");
        runner.setAiDailyScansUsed(0);
        runner.setAiDailyResetDate(LocalDate.now());
        return runner;
    }

    @Test
    void tryConsumeQuotaReturnNullAndIncrementsCountWhenQuotaAvailable() {
        Runner runner = freshRunner();
        when(runnerRepository.sumAiDailyScansUsedForDate(any(LocalDate.class))).thenReturn(0L);
        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> inv.getArgument(0));

        String result = service.tryConsumeQuota(runner);

        assertThat(result).isNull();
        assertThat(runner.getAiDailyScansUsed()).isEqualTo(1);
        verify(runnerRepository, atLeastOnce()).save(runner);
    }

    @Test
    void tryConsumeQuotaReturnsUserLimitErrorWhenRunnerQuotaExhausted() {
        Runner runner = freshRunner();
        runner.setAiDailyScansUsed(3); // at the per-runner limit of 3; project check not reached

        String result = service.tryConsumeQuota(runner);

        assertThat(result).isEqualTo("AI_FREE_TIER_USER_LIMIT");
        assertThat(runner.getAiDailyScansUsed()).isEqualTo(3); // not incremented
    }

    @Test
    void tryConsumeQuotaReturnsProjectLimitErrorWhenProjectQuotaExhausted() {
        Runner runner = freshRunner();
        // project limit: projectDailyLimit(100) - projectDailyReserve(0) = 100; usage at 100
        when(runnerRepository.sumAiDailyScansUsedForDate(any(LocalDate.class))).thenReturn(100L);

        String result = service.tryConsumeQuota(runner);

        assertThat(result).isEqualTo("AI_FREE_TIER_PROJECT_LIMIT");
        assertThat(runner.getAiDailyScansUsed()).isEqualTo(0);
        verify(runnerRepository, never()).save(runner);
    }

    @Test
    void tryConsumeQuotaResetsDailyWindowWhenDateHasChanged() {
        Runner runner = freshRunner();
        runner.setAiDailyScansUsed(3); // would be exhausted if today
        runner.setAiDailyResetDate(LocalDate.now().minusDays(1)); // yesterday's date
        when(runnerRepository.sumAiDailyScansUsedForDate(any(LocalDate.class))).thenReturn(0L);
        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> inv.getArgument(0));

        String result = service.tryConsumeQuota(runner);

        assertThat(result).isNull(); // window reset, scans should succeed
        assertThat(runner.getAiDailyScansUsed()).isEqualTo(1);
    }

    @Test
    void tryConsumeQuotaIsAtomicNoConcurrentOverConsumption() throws Exception {
        // per-runner limit = 3; 10 concurrent threads try to consume
        // at most 3 should succeed
        Runner runner = freshRunner();
        AtomicInteger savedCount = new AtomicInteger(0);
        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> {
            savedCount.incrementAndGet();
            return inv.getArgument(0);
        });
        when(runnerRepository.sumAiDailyScansUsedForDate(any(LocalDate.class))).thenAnswer(inv -> (long) runner.getAiDailyScansUsed());

        int threads = 10;
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<String>> futures = new ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return service.tryConsumeQuota(runner);
            }));
        }

        ready.await();
        go.countDown();
        pool.shutdown();

        long successCount = futures.stream()
                .map(f -> {
                    try { return f.get(); } catch (Exception e) { return "ERROR"; }
                })
                .filter(r -> r == null)
                .count();

        assertThat(successCount).isLessThanOrEqualTo(3);
        assertThat(runner.getAiDailyScansUsed()).isLessThanOrEqualTo(3);
    }

    @Test
    void tryConsumeQuotaDoesNotSaveOnBlockedRequest() {
        Runner runner = freshRunner();
        runner.setAiDailyScansUsed(3); // per-runner limit hit; returns early, no save

        service.tryConsumeQuota(runner);

        verify(runnerRepository, never()).save(runner);
    }
}
