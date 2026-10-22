package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
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
 * What an import keeps of a file: the heart-rate summary a GPX or TCX file does not state (BUG-013), and a name that fits the
 * column however long the file's is (BUG-020, which was a 500 on the import route).
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-import-summaries;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ActivityImportSummariesTests {

    @Autowired private ActivityImportService importService;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("summaries-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private static MockMultipartFile upload(String name, String content) {
        return new MockMultipartFile("exports", name, "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
    }

    private Activity only(Runner owner) {
        List<Activity> saved = activities.findAll().stream().filter(a -> a.getRunner().getId().equals(owner.getId())).toList();
        assertThat(saved).hasSize(1);
        return saved.get(0);
    }

    private static String gpx(String name, int[] heartRates) {
        StringBuilder points = new StringBuilder();
        for (int i = 0; i < heartRates.length; i++) {
            points.append("<trkpt lat=\"%.5f\" lon=\"-74.00000\"><time>2026-10-01T11:%02d:00Z</time><extensions><gpxtpx:TrackPointExtension>"
                    .formatted(40.7 + i * 0.001, i))
                    .append("<gpxtpx:hr>").append(heartRates[i]).append("</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>");
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"
                     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
                  <trk><name>%s</name><type>running</type><trkseg>%s</trkseg></trk>
                </gpx>
                """.formatted(name, points);
    }

    @Test
    void aGpxRunWithHeartRateOnItsPointsHasAnAverageAndAMaximum() {
        Runner owner = runner();

        importService.importFile(owner, ImportProvider.GARMIN, upload("hr.gpx", gpx("Hill repeats", new int[] {120, 130, 170, 150, 190})));

        Activity run = only(owner);
        assertThat(run.getMaxHeartRate()).isEqualTo(190.0);
        // One reading a minute, each counted for the 30 s the gap allows, the last for none: (120 + 130 + 170 + 150) / 4.
        assertThat(run.getAverageHeartRate()).isEqualTo(142.5);
    }

    @Test
    void aGpxRunWithoutHeartRateStillHasNone() {
        Runner owner = runner();
        String plain = gpx("No strap", new int[] {1, 1, 1}).replaceAll("<extensions>.*?</extensions>", "");

        importService.importFile(owner, ImportProvider.GARMIN, upload("plain.gpx", plain));

        Activity run = only(owner);
        assertThat(run.getAverageHeartRate()).isNull();
        assertThat(run.getMaxHeartRate()).isNull();
    }

    @Test
    void aVeryLongTrackNameIsShortenedToTheColumnInsteadOfFailingTheInsert() {
        Runner owner = runner();

        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN,
                upload("long.gpx", gpx("x".repeat(5000), new int[] {140, 141, 142})));

        assertThat(result.importedActivities()).isEqualTo(1);
        assertThat(only(owner).getName()).hasSize(255);
    }

    @Test
    void theNameIsNotCutInTheMiddleOfAnEmoji() {
        Runner owner = runner();
        String name = "a".repeat(254) + "🏃‍♀️".repeat(10);

        importService.importFile(owner, ImportProvider.GARMIN, upload("emoji.gpx", gpx(name, new int[] {140, 141, 142})));

        String saved = only(owner).getName();
        assertThat(saved.length()).isLessThanOrEqualTo(255);
        assertThat(Character.isHighSurrogate(saved.charAt(saved.length() - 1))).isFalse();
    }

    @Test
    void aVeryLongFileNameIsKeptToTheColumnToo() {
        Runner owner = runner();
        String fileName = "f".repeat(400) + ".gpx";

        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN, upload(fileName, gpx("Short name", new int[] {140, 141, 142})));

        assertThat(result.importedActivities()).isEqualTo(1);
        assertThat(only(owner).getSourceFileName()).hasSize(255);
    }
}
