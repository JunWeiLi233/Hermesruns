package com.hermes.backend.imports;

import com.hermes.backend.coaching.BodyCompositionDataRepository;
import com.hermes.backend.coaching.CoachRunnerStateRepository;
import com.hermes.backend.coaching.DailyHRVDataRepository;
import com.hermes.backend.coaching.DailySleepDataRepository;
import com.hermes.backend.coaching.DailyStressDataRepository;
import com.hermes.backend.coaching.DailyWellnessSummaryRepository;
import com.hermes.backend.runner.Runner;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GarminWellnessCompletionTests {
    private final DailyWellnessSummaryRepository wellness = mock(DailyWellnessSummaryRepository.class);
    private final GarminWellnessImportService service = spy(new GarminWellnessImportService(
            wellness, mock(DailySleepDataRepository.class), mock(DailyHRVDataRepository.class),
            mock(DailyStressDataRepository.class), mock(BodyCompositionDataRepository.class),
            mock(CoachRunnerStateRepository.class), new ObjectMapper()));

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(73L);
        return runner;
    }

    @Test
    void completionWaitsForDownloadAndRejectsOverlappingImport() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timed out");
            return Map.of("success", true, "days", List.of());
        }).when(service).callPythonWellnessDownloader(anyString(), anyString(), any(), any());
        var result = CompletableFuture.supplyAsync(() -> service.importWellnessNow(runner(), "test", "test", 21));
        try {
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(result).isNotDone();
            assertThat(service.importWellnessNow(runner(), "test", "test", 21)).isFalse();
        } finally {
            release.countDown();
        }
        assertThat(result.get(5, TimeUnit.SECONDS)).isTrue();
        assertThat(service.getStatus(73L).status()).isEqualTo("COMPLETED");
    }

    @Test
    void downloadFailureIsNotACompletedSync() throws Exception {
        doReturn(Map.of("success", false, "error", "test download failure"))
                .when(service).callPythonWellnessDownloader(anyString(), anyString(), any(), any());
        assertThat(service.importWellnessNow(runner(), "test", "test", 21)).isFalse();
        assertThat(service.getStatus(73L).status()).isEqualTo("FAILED");
    }

    @Test
    void partialPersistenceIsNotACompletedSync() throws Exception {
        doReturn(Map.of("success", true, "days", List.of(
                Map.of("date", "2026-08-20", "wellness", Map.of("total_steps", 1000)),
                Map.of("date", "2026-08-21", "wellness", Map.of("total_steps", 2000)))))
                .when(service).callPythonWellnessDownloader(anyString(), anyString(), any(), any());
        when(wellness.save(any())).thenThrow(new IllegalStateException("test write failure"))
                .thenAnswer(invocation -> invocation.getArgument(0));
        assertThat(service.importWellnessNow(runner(), "test", "test", 21)).isFalse();
        assertThat(service.getStatus(73L).daysPersisted()).isEqualTo(1);
        assertThat(service.getStatus(73L).status()).isEqualTo("FAILED");
    }
}
