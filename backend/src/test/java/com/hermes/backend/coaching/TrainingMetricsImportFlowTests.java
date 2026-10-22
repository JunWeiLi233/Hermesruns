package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.imports.ActivityImportService;
import com.hermes.backend.imports.ImportController;
import com.hermes.backend.imports.ImportResult;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import com.hermes.backend.shoes.ShoeInventoryService;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * A file import, start to finish through the real import service and the real event wiring: after the import
 * commits, the run's effort score and zone times are there without anyone opening the run.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-metrics-import-flow;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class TrainingMetricsImportFlowTests {

    @Autowired private ActivityImportService importService;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private RunnerRepository runners;
    @Autowired private ShoeRepository shoes;
    @Autowired private ShoeInventoryService inventory;
    @Autowired private AutomatedCoachService coach;
    @Autowired private CoachRunnerStateRepository coachStates;

    /** Twelve minutes at 1 Hz, heart rate 140 throughout. */
    private static byte[] gpxWithHeartRate(int bpm) {
        StringBuilder points = new StringBuilder();
        for (int second = 0; second < 720; second++) {
            points.append("<trkpt lat=\"").append(String.format("%.6f", 40.7 + second * 0.00003)).append("\" lon=\"-73.9\">")
                    .append("<ele>10</ele><time>2026-10-01T11:").append(String.format("%02d:%02d", second / 60, second % 60)).append("Z</time>")
                    .append("<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>").append(bpm).append("</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>")
                    .append("</trkpt>");
        }
        String gpx = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<gpx version=\"1.1\" creator=\"test\" xmlns=\"http://www.topografix.com/GPX/1/1\""
                + " xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\">"
                + "<trk><name>Morning Run</name><type>running</type><trkseg>" + points + "</trkseg></trk></gpx>";
        return gpx.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void anImportedRunHasItsEffortAndZoneTimesStraightAway() {
        Runner owner = runners.saveAndFlush(new Runner("import-flow-" + UUID.randomUUID() + "@hermes.test", "active"));

        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN,
                new MockMultipartFile("exports", "morning.gpx", "application/octet-stream", gpxWithHeartRate(140)));

        assertThat(result.importedActivities()).isEqualTo(1);
        List<Activity> runs = activities.findAll().stream().filter(a -> a.getRunner().getId().equals(owner.getId())).toList();
        assertThat(runs).hasSize(1);
        ActivityTrainingMetrics row = metrics.findByActivityIdAndRunnerId(runs.get(0).getId(), owner.getId()).orElseThrow();
        assertThat(row.getEffortSource()).isEqualTo(EffortModel.HR_ZONES);
        assertThat(row.zoneSeconds()).containsExactly(0, 0, 720, 0, 0);
        assertThat(row.getEffortScore()).isEqualTo(36.0);
        assertThat(row.getLocalDate().toString()).isEqualTo("2026-10-01");
    }

    @Test
    void importingTheSameFileAgainAddsNoSecondRow() {
        Runner owner = runners.saveAndFlush(new Runner("import-flow-" + UUID.randomUUID() + "@hermes.test", "active"));
        MockMultipartFile file = new MockMultipartFile("exports", "morning.gpx", "application/octet-stream", gpxWithHeartRate(150));

        importService.importFile(owner, ImportProvider.GARMIN, file);
        ImportResult again = importService.importFile(owner, ImportProvider.GARMIN, file);

        assertThat(again.skippedDuplicates()).isEqualTo(1);
        long rows = activities.findAll().stream().filter(a -> a.getRunner().getId().equals(owner.getId()))
                .filter(a -> metrics.findByActivityIdAndRunnerId(a.getId(), owner.getId()).isPresent()).count();
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void partialRetriesAndCrossSourceExportsPreserveHistoryTrainingAndShoeMileage() {
        Runner owner = runners.saveAndFlush(new Runner("import-integrity-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        String day = LocalDate.now().minusDays(1).toString();
        byte[] first = new String(gpxWithHeartRate(140), StandardCharsets.UTF_8)
                .replace("2026-10-01", day).getBytes(StandardCharsets.UTF_8);
        MockMultipartFile good = new MockMultipartFile("exports", "run.gpx", "application/octet-stream", first);
        MockMultipartFile bad = new MockMultipartFile("exports", "broken.gpx", "application/octet-stream", "not xml".getBytes(StandardCharsets.UTF_8));
        AuthService auth = mock(AuthService.class);
        when(auth.findByAuthorizationHeader("Bearer test")).thenReturn(Optional.of(owner));
        ImportController controller = new ImportController(auth, importService);
        ImportResult partial = (ImportResult) controller.importBatch("Bearer test", List.of(good, bad), null, null, null).getBody();
        assertThat(partial.importedActivities()).isEqualTo(1);
        assertThat(partial.rejectedFiles()).hasSize(1).allSatisfy(detail -> assertThat(detail).startsWith("broken.gpx:"));

        Activity saved = activities.findByRunnerAndActivityTypeOrderByIdDesc(owner, ActivityType.RUN).get(0);
        double distance = saved.getDistanceKm();
        Shoe shoe = new Shoe();
        shoe.setRunner(owner);
        shoe.setBrand("Test");
        shoe.setModel("Daily trainer");
        shoe.setInitialDistanceKm(12.0);
        shoe = shoes.saveAndFlush(shoe);
        inventory.assignShoeToActivity(owner, shoe.getId(), saved.getId());
        double effort = metrics.findByActivityIdAndRunnerId(saved.getId(), owner.getId()).orElseThrow().getEffortScore();
        double volume = coach.getCoachState(owner).volumeKm7d();

        // Correct only the rejected file, leaving the previously accepted file selected.
        byte[] corrected = new String(first, StandardCharsets.UTF_8).replace("T11:", "T12:").getBytes(StandardCharsets.UTF_8);
        MockMultipartFile fixed = new MockMultipartFile("exports", "broken.gpx", "application/octet-stream", corrected);
        ImportResult retry = (ImportResult) controller.importBatch("Bearer test", List.of(good, fixed), null, null, null).getBody();
        assertThat(retry.importedActivities()).isEqualTo(1);
        assertThat(retry.skippedDuplicates()).isEqualTo(1);
        assertThat(retry.rejectedFiles()).isEmpty();

        // Different provider and bytes must hit structural dedup, not the provider/checksum guard.
        byte[] reexport = new String(first, StandardCharsets.UTF_8).replace("creator=\"test\"", "creator=\"other-device\"").getBytes(StandardCharsets.UTF_8);
        for (ImportProvider provider : List.of(ImportProvider.GARMIN, ImportProvider.COROS, ImportProvider.HUAWEI)) {
            ImportResult again = importService.importFile(owner, provider,
                    new MockMultipartFile("file", "reexport.gpx", "application/octet-stream", reexport));
            assertThat(again.importedActivities()).isZero();
            assertThat(again.skippedDuplicates()).isEqualTo(1);
        }
        String tcx = "<TrainingCenterDatabase><Activities><Activity Sport=\"Running\"><Id>" + day
                + "T11:00:00Z</Id><Lap><TotalTimeSeconds>719</TotalTimeSeconds><DistanceMeters>"
                + saved.getDistanceMeters() + "</DistanceMeters><Track><Trackpoint><Time>" + day
                + "T11:00:00Z</Time><Position><LatitudeDegrees>40.7</LatitudeDegrees><LongitudeDegrees>-73.9</LongitudeDegrees></Position></Trackpoint>"
                + "<Trackpoint><Time>" + day + "T11:11:59Z</Time><Position><LatitudeDegrees>40.72157</LatitudeDegrees><LongitudeDegrees>-73.9</LongitudeDegrees></Position>"
                + "</Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        ImportResult crossFormat = importService.importFile(owner, ImportProvider.COROS,
                new MockMultipartFile("coros", "run.tcx", "application/octet-stream", tcx.getBytes(StandardCharsets.UTF_8)));
        assertThat(crossFormat.skippedDuplicates()).isEqualTo(1);
        assertThat(crossFormat.importedActivities()).isZero();

        List<Activity> history = activities.findByRunnerAndActivityTypeOrderByIdDesc(owner, ActivityType.RUN);
        assertThat(history).hasSize(2);
        assertThat(history.stream().mapToDouble(Activity::getDistanceKm).sum()).isCloseTo(distance * 2, org.assertj.core.data.Offset.offset(0.001));
        assertThat(history.stream().mapToDouble(run -> metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId()).orElseThrow().getEffortScore()).sum()).isEqualTo(effort * 2);
        assertThat(coach.getCoachState(owner).volumeKm7d()).isCloseTo(volume * 2, org.assertj.core.data.Offset.offset(0.1));
        assertThat(activities.sumDistanceKmByShoeId(shoe.getId())).isEqualTo(distance);
        assertThat(inventory.listShoes(owner, false).get(0).getCurrentDistanceKm()).isCloseTo(12 + distance, org.assertj.core.data.Offset.offset(0.01));
        assertThat(activities.findById(saved.getId()).orElseThrow().getShoeId()).isEqualTo(shoe.getId());
    }

    @Test
    void parallelFirstUseRequestsCreateOneUsableCoachState() throws Exception {
        Runner owner = runners.saveAndFlush(new Runner("first-use-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        var executor = Executors.newFixedThreadPool(4);
        var ready = new CountDownLatch(4);
        var start = new CountDownLatch(1);
        try {
            var requests = java.util.stream.IntStream.range(0, 4).mapToObj(index -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Requests did not start together");
                return index % 2 == 0 ? coach.getCoachState(owner) : coach.getCoachStatePreservingSchedule(owner);
            })).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (var request : requests) assertThat(request.get(30, TimeUnit.SECONDS).volumeKm7d()).isZero();
            assertThat(coachStates.findAll().stream().filter(state -> state.getRunner().getId().equals(owner.getId()))).hasSize(1);
            // First use creates usable state, but no run history cannot justify a workout prescription.
            var response = coach.getTodayWithReadiness(owner);
            var today = response.today();
            assertThat(today.reasonCode()).isEqualTo("history_required");
            assertThat(today.intent()).isEqualTo("unavailable");
            assertThat(response.plan().targetWeeklyKm()).isZero();
            assertThat(today.plannedDistanceKm()).isNull();
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void aRecentUtcFileCountsEvenWhenTheServerClockIsOnAnEarlierLocalHour() {
        Runner owner = runners.saveAndFlush(new Runner("utc-import-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        java.time.Instant start = java.time.Instant.now().minusSeconds(3600);
        java.time.LocalDateTime serverNow = java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).minusHours(8);
        String gpx = "<gpx><trk><type>running</type><trkseg><trkpt lat=\"40.7\" lon=\"-73.9\"><time>"
                + start + "</time></trkpt><trkpt lat=\"40.71\" lon=\"-73.9\"><time>" + start.plusSeconds(600)
                + "</time></trkpt></trkseg></trk></gpx>";
        try (var clocks = org.mockito.Mockito.mockStatic(java.time.LocalDateTime.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
            clocks.when(java.time.LocalDateTime::now).thenReturn(serverNow);
            ImportResult result = importService.importFile(owner, ImportProvider.GARMIN,
                    new MockMultipartFile("exports", "recent.gpx", "application/octet-stream", gpx.getBytes(StandardCharsets.UTF_8)));
            assertThat(result.importedActivities()).isEqualTo(1);
            double distance = activities.findByRunnerAndActivityTypeOrderByIdDesc(owner, ActivityType.RUN).get(0).getDistanceKm();
            assertThat(coach.getCoachState(owner).volumeKm7d()).isCloseTo(distance, org.assertj.core.data.Offset.offset(0.1));
        }
    }
}
