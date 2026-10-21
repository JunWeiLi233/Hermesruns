package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.coaching.CoachRunnerStateRepository;
import com.hermes.backend.rewards.DigitalCosmeticsService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.weather.AcclimatizationService;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Real importer/database transactions: no mocked parsers, duplicate query or coaching aggregates. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:import-concurrency;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.hikari.maximum-pool-size=4",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.training.async=false",
        "app.official-course.startup-seed.enabled=false",
        "app.local-shared-runner.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false"
})
class ActivityImportConcurrencyTests {
    @Autowired private ActivityImportService importer;
    @Autowired private RunnerRepository runners;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private ActivityRepository activities;
    @Autowired private CoachRunnerStateRepository coachStates;
    @MockitoBean private AcclimatizationService weather;
    @MockitoBean private DigitalCosmeticsService cosmetics;

    @Test
    void concurrentReexportsYieldOneImportAndOneDuplicateAcrossFileProviders() throws Exception {
        Runner runner = runner();
        Instant start = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        var results = concurrent(runner, ImportProvider.GARMIN, tcx(start, 16000, "export A"),
                ImportProvider.COROS, tcx(start, 16000, "export B"));
        assertThat(results.stream().mapToInt(ImportResult::importedActivities).sum()).isEqualTo(1);
        assertThat(results.stream().mapToInt(ImportResult::skippedDuplicates).sum()).isEqualTo(1);
        assertDuplicateOutcomes(results, "This activity was already imported (matched by start time and distance).");
        assertStoredAndCoach(runner, 1, 16.0);
    }

    @Test
    void concurrentIdenticalBytesReturnDuplicateRatherThanAStorageRejection() throws Exception {
        Runner runner = runner();
        var file = tcx(Instant.now().minus(1, ChronoUnit.DAYS), 14000, "identical");
        var results = concurrent(runner, ImportProvider.GARMIN, file, ImportProvider.GARMIN, file);
        assertThat(results.stream().mapToInt(ImportResult::importedActivities).sum()).isEqualTo(1);
        assertThat(results.stream().mapToInt(ImportResult::skippedDuplicates).sum()).isEqualTo(1);
        assertDuplicateOutcomes(results, "This activity file was already imported.");
        assertStoredAndCoach(runner, 1, 14.0);
    }

    @Test
    void concurrentDistinctRunsPersistBothActivitiesAndBothRollingVolumes() throws Exception {
        // Fresh runners avoid hiding first-aggregation/last-writer races behind a populated state.
        for (int attempt = 0; attempt < 3; attempt++) {
            Runner runner = runner();
            Instant start = Instant.now().minus(1, ChronoUnit.DAYS);
            var results = concurrent(runner, ImportProvider.GARMIN, tcx(start, 12000, "distinct A"),
                    ImportProvider.GARMIN, tcx(start.plus(1, ChronoUnit.HOURS), 13000, "distinct B"));
            assertThat(results.stream().mapToInt(ImportResult::importedActivities).sum()).isEqualTo(2);
            assertThat(results.stream().mapToInt(ImportResult::skippedDuplicates).sum()).isZero();
            assertStoredAndCoach(runner, 2, 25.0);
        }
    }

    @Test
    void invalidArchiveRollsBackEarlierEntriesAndDoesNotPoisonTheNextImport() throws Exception {
        Runner runner = runner();
        Instant start = Instant.now().minus(1, ChronoUnit.DAYS);
        var valid = tcx(start, 8000, "archive run");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry("valid.tcx"));
            zip.write(valid.getBytes());
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("broken.tcx"));
            zip.write("not XML".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        assertThatThrownBy(() -> importer.importFile(runner, ImportProvider.GARMIN,
                new MockMultipartFile("exports", "broken.zip", "application/zip", output.toByteArray())))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(ownedActivities(runner)).isEmpty();
        assertThat(coachStates.findByRunner(runner)).isEmpty();
        assertThat(importer.importFile(runner, ImportProvider.GARMIN, valid).importedActivities()).isEqualTo(1);
        assertStoredAndCoach(runner, 1, 8.0);
    }

    private Runner runner() {
        return runners.saveAndFlush(new Runner("concurrency-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
    }

    private List<ImportResult> concurrent(Runner runner, ImportProvider leftProvider, MockMultipartFile left,
                                        ImportProvider rightProvider, MockMultipartFile right) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var firstImported = new CountDownLatch(1);
        var secondEnteredTransaction = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        // Real nested REQUIRED transactions: hold the first import open before its actual
        // commit while the second transaction starts its import. No repository/query/lock is
        // mocked, and scheduler timing cannot turn this into two sequential committed uploads.
        var transactions = new TransactionTemplate(transactionManager);
        try {
            var first = executor.submit(() -> {
                ready.countDown(); start.await();
                return transactions.execute(status -> {
                    var result = importer.importFile(runner, leftProvider, left);
                    firstImported.countDown();
                    awaitGate(releaseFirst);
                    return result;
                });
            });
            var second = executor.submit(() -> {
                ready.countDown(); start.await(); awaitGate(firstImported);
                return transactions.execute(status -> {
                    secondEnteredTransaction.countDown();
                    return importer.importFile(runner, rightProvider, right);
                });
            });
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(firstImported.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(secondEnteredTransaction.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(first.isDone()).isFalse();
            assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS))
                    .isInstanceOf(TimeoutException.class);
            releaseFirst.countDown();
            var results = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertThat(results).extracting(ImportResult::provider)
                    .containsExactly(leftProvider.name(), rightProvider.name());
            return results;
        } finally {
            start.countDown();
            releaseFirst.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    private void awaitGate(CountDownLatch gate) {
        try {
            assertThat(gate.await(5, TimeUnit.SECONDS)).isTrue();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted concurrency test gate", exception);
        }
    }

    private List<Activity> ownedActivities(Runner runner) {
        return activities.findAll().stream().filter(a -> a.getRunner().getId().equals(runner.getId())).toList();
    }

    private void assertStoredAndCoach(Runner runner, int expectedCount, double expectedKm) {
        // Each repository call starts a fresh read after both import transactions have completed.
        var stored = ownedActivities(runner);
        assertThat(stored).hasSize(expectedCount);
        assertThat(stored.stream().mapToDouble(Activity::getDistanceKm).sum()).isEqualTo(expectedKm);
        assertThat(stored.stream().mapToInt(Activity::getMovingTimeSeconds).sum()).isEqualTo(expectedCount * 3600);
        var state = coachStates.findByRunner(runner).orElseThrow();
        assertThat(state.getVolumeKm7d()).isEqualTo(expectedKm);
        assertThat(state.getVolumeKm28d()).isEqualTo(expectedKm);
    }

    private void assertDuplicateOutcomes(List<ImportResult> results, String duplicateMessage) {
        var winners = results.stream().filter(result -> result.importedActivities() == 1).toList();
        var duplicates = results.stream().filter(result -> result.skippedDuplicates() == 1).toList();
        assertThat(winners).hasSize(1);
        assertThat(duplicates).hasSize(1);
        var winner = winners.get(0);
        var duplicate = duplicates.get(0);
        assertThat(winner.importedPoints()).isEqualTo(2);
        assertThat(winner.skippedDuplicates()).isZero();
        assertThat(winner.message()).isEqualTo("Import completed successfully.");
        assertThat(duplicate.importedActivities()).isZero();
        assertThat(duplicate.importedPoints()).isZero();
        assertThat(duplicate.message()).isEqualTo(duplicateMessage);
        assertThat(results).allSatisfy(result -> {
            assertThat(result.skippedNonRuns()).isZero();
            assertThat(result.rejectedFiles()).isEmpty();
        });
    }

    private MockMultipartFile tcx(Instant start, double meters, String notes) {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
                  <Activities><Activity Sport="Running"><Id>%s</Id><Lap StartTime="%s">
                    <TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>%.0f</DistanceMeters>
                    <Track><Trackpoint><Time>%s</Time><Position><LatitudeDegrees>0</LatitudeDegrees><LongitudeDegrees>0</LongitudeDegrees></Position></Trackpoint>
                    <Trackpoint><Time>%s</Time><Position><LatitudeDegrees>0.001</LatitudeDegrees><LongitudeDegrees>0</LongitudeDegrees></Position></Trackpoint></Track>
                  </Lap><Notes>%s</Notes></Activity></Activities>
                </TrainingCenterDatabase>
                """.formatted(start, start, meters, start, start.plusSeconds(3600), notes);
        return new MockMultipartFile("exports", "synthetic.tcx", "application/xml", xml.getBytes(StandardCharsets.UTF_8));
    }
}
