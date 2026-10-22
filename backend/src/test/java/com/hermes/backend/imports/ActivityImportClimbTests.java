package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

/** A GPX file carries the elevation of every point, not the climb: the importer adds it up (BUG-036). */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-import-climb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ActivityImportClimbTests {

    @Autowired private ActivityImportService importService;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("climb-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    /** A track of points a hundred metres apart, thirty seconds apart, with these elevations (null leaves out the element). */
    private static String gpx(String name, Double... elevations) {
        StringBuilder points = new StringBuilder();
        for (int i = 0; i < elevations.length; i++) {
            points.append(String.format("<trkpt lat=\"%.5f\" lon=\"-74.00000\">", 40.7 + i * 0.0009));
            if (elevations[i] != null) {
                points.append("<ele>").append(elevations[i]).append("</ele>");
            }
            points.append(String.format("<time>2026-10-01T11:%02d:%02dZ</time></trkpt>%n", (30 * i) / 60 + 30, (30 * i) % 60));
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
                  <trk><name>%s</name><type>running</type><trkseg>
                %s  </trkseg></trk>
                </gpx>
                """.formatted(name, points);
    }

    private Activity importOne(Runner owner, String fileName, String content) {
        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN,
                new MockMultipartFile("file", fileName, "application/gpx+xml", content.getBytes(StandardCharsets.UTF_8)));
        assertThat(result.importedActivities()).as(result.message()).isEqualTo(1);
        return activities.findAll().stream().filter(a -> a.getRunner().getId().equals(owner.getId())).findFirst().orElseThrow();
    }

    @Test
    void aFileWithElevationGivesTheRunItsClimb() {
        Activity run = importOne(runner(), "hills.gpx", gpx("Hills", 10.0, 30.0, 50.0, 40.0, 20.0, 40.0, 70.0));

        // Up 40, down 30, up 50.
        assertThat(run.getTotalElevationGain()).isEqualTo(90.0);
    }

    @Test
    void theFlickerOfTheSensorOnFlatGroundIsNotAClimb() {
        Activity run = importOne(runner(), "flat.gpx", gpx("Flat", 100.0, 101.0, 99.5, 101.0, 100.0, 100.8, 99.2, 101.0));

        assertThat(run.getTotalElevationGain()).isEqualTo(0.0);
    }

    @Test
    void aFileWithNoElevationHasNoClimbFigureWhichIsNotZero() {
        Activity run = importOne(runner(), "treadmill.gpx", gpx("No elevation", null, null, null, null, null));

        assertThat(run.getTotalElevationGain()).isNull();
    }
}
