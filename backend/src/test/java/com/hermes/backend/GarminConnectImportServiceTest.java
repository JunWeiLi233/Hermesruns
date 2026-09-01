package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GarminConnectImportServiceTest {

    @Test
    void syncTrackerRateLimitCooldownBlocksImmediateRetry() {
        GarminConnectImportService.GarminSyncTracker tracker = new GarminConnectImportService.GarminSyncTracker();
        tracker.tryBegin();
        tracker.markRateLimited("Garmin is temporarily rate limiting login attempts.", 900);

        GarminConnectImportService.GarminSyncStatus snapshot = tracker.snapshot();

        assertThat(snapshot.active()).isFalse();
        assertThat(snapshot.status()).isEqualTo("RATE_LIMITED");
        assertThat(snapshot.message()).contains("temporarily rate limiting");
        assertThat(snapshot.retryAfterSeconds()).isBetween(1L, 900L);
        assertThat(tracker.tryBegin()).isFalse();
    }

    @Test
    void importSingleActivityPersistsPointsThroughBatchedActivityDataAccess() throws Exception {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        FitActivityFileParser fitParser = mock(FitActivityFileParser.class);
        GarminConnectImportService service = new GarminConnectImportService(
                activityRepository, activityPointRepository, activityDataAccess, fitParser, mock(ObjectMapper.class));
        GarminConnectImportService.GarminSyncTracker tracker = new GarminConnectImportService.GarminSyncTracker();
        tracker.tryBegin();

        Path fitFile = Files.createTempFile("hermes-garmin-test", ".fit");
        try {
            Files.write(fitFile, new byte[]{1});
            when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(any(), any(), any()))
                    .thenReturn(false);
            when(fitParser.parse(any(String.class), any(byte[].class))).thenReturn(new ParsedActivityData(
                    "Morning Run",
                    ActivityType.RUN,
                    LocalDateTime.of(2026, 1, 1, 6, 0),
                    5000d,
                    1500L,
                    List.of(
                            new ParsedTrackPoint(40.000, -73.000),
                            new ParsedTrackPoint(40.001, -73.001),
                            new ParsedTrackPoint(40.002, -73.002)
                    ),
                    150d,
                    165d));
            when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
                Activity activity = invocation.getArgument(0);
                activity.setId(77L);
                return activity;
            });

            ReflectionTestUtils.invokeMethod(service, "importSingleActivity",
                    new Runner(),
                    Map.of("filePath", fitFile.toString(), "activityId", "garmin-123", "name", "Morning Run"),
                    tracker);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<ActivityPoint>> pointsCaptor = ArgumentCaptor.forClass(List.class);
            verify(activityDataAccess).savePoints(pointsCaptor.capture());
            List<ActivityPoint> savedPoints = pointsCaptor.getValue();
            assertThat(savedPoints).hasSize(3);
            for (int i = 0; i < savedPoints.size(); i++) {
                assertThat(savedPoints.get(i).getSequenceIndex()).isEqualTo(i);
                assertThat(savedPoints.get(i).getActivity().getId()).isEqualTo(77L);
            }
            assertThat(savedPoints.get(0).getLatitude()).isEqualTo(40.000);
            assertThat(savedPoints.get(0).getLongitude()).isEqualTo(-73.000);
            // Points go through the batched raw-JDBC path only — never the
            // per-row repository saveAll/flush that IDENTITY inserts punish.
            verify(activityPointRepository, never()).saveAll(any());
            verify(activityPointRepository, never()).flush();

            GarminConnectImportService.GarminSyncStatus snapshot = tracker.snapshot();
            assertThat(snapshot.importedRuns()).isEqualTo(1);
            assertThat(snapshot.importedPoints()).isEqualTo(3);
        } finally {
            Files.deleteIfExists(fitFile);
        }
    }

    @Test
    void importSingleActivitySkipsDuplicateActivityWithoutPersistingAnything() throws Exception {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);
        GarminConnectImportService service = new GarminConnectImportService(
                activityRepository, activityPointRepository, activityDataAccess,
                mock(FitActivityFileParser.class), mock(ObjectMapper.class));
        GarminConnectImportService.GarminSyncTracker tracker = new GarminConnectImportService.GarminSyncTracker();
        tracker.tryBegin();

        Path fitFile = Files.createTempFile("hermes-garmin-test", ".fit");
        try {
            Files.write(fitFile, new byte[]{1});
            // Duplicate guard fires at the activity level before any parse/insert.
            when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(any(), any(), any()))
                    .thenReturn(true);

            ReflectionTestUtils.invokeMethod(service, "importSingleActivity",
                    new Runner(),
                    Map.of("filePath", fitFile.toString(), "activityId", "garmin-123"),
                    tracker);

            verify(activityRepository, never()).save(any(Activity.class));
            verify(activityDataAccess, never()).savePoints(any());
            verify(activityPointRepository, never()).saveAll(any());

            GarminConnectImportService.GarminSyncStatus snapshot = tracker.snapshot();
            assertThat(snapshot.skippedDuplicates()).isEqualTo(1);
            assertThat(snapshot.importedRuns()).isZero();
            assertThat(snapshot.importedPoints()).isZero();
        } finally {
            Files.deleteIfExists(fitFile);
        }
    }
}
