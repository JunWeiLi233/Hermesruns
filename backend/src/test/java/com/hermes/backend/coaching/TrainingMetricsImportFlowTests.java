package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.imports.ActivityImportService;
import com.hermes.backend.imports.ImportResult;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A file import, start to finish through the real import service and the real event wiring: after the import
 * commits, the run's effort score and zone times are there without anyone opening the run.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-metrics-import-flow;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
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
}
