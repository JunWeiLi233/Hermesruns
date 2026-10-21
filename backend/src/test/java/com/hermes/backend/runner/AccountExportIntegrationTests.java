package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.races.RaceEvent;
import com.hermes.backend.races.RaceEventRepository;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** The data export, read back out of the ZIP it produces. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:account-export-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AccountExportIntegrationTests {

    @Autowired private AccountExportService exports;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityPointRepository points;
    @Autowired private ShoeRepository shoes;
    @Autowired private RaceEventRepository races;

    private Runner runner() {
        Runner runner = new Runner("export-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setDisplayName("Exporter");
        runner.setStravaAccessToken("secret-access-token");
        runner.setStravaRefreshToken("secret-refresh-token");
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, String name, ImportProvider provider, boolean apiSourced) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName(name);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(provider);
        run.setStravaApiSourced(apiSourced);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 7, 30, 0));
        run.setDistanceMeters(5000.0);
        run.setDistanceKm(5.0);
        run.setMovingTimeSeconds(1500);
        Activity saved = activities.saveAndFlush(run);
        for (int i = 0; i < 3; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(saved);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + i * 0.001);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i * 10);
            point.setElevationMeters(12.5 + i);
            point.setHeartRate(140 + i);
            points.saveAndFlush(point);
        }
        return saved;
    }

    private Map<String, String> unzip(byte[] zipped) throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zipped), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                entries.put(entry.getName(), new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return entries;
    }

    private Map<String, String> export(Runner owner, boolean tracks) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        exports.write(owner, tracks, out);
        return unzip(out.toByteArray());
    }

    @Test
    void containsTheRunnersOwnDataAndNobodyElses() throws IOException {
        Runner owner = runner();
        Runner stranger = runner();
        Activity fileRun = run(owner, "Tempo, with comma", ImportProvider.GARMIN, false);
        Activity apiRun = run(owner, "=HYPERLINK(\"http://evil.example\",\"click\")", ImportProvider.STRAVA, true);
        run(stranger, "someone else's run", ImportProvider.GARMIN, false);
        Shoe shoe = new Shoe();
        shoe.setRunner(owner);
        shoe.setBrand("Nike");
        shoe.setModel("Pegasus");
        shoes.saveAndFlush(shoe);
        RaceEvent race = new RaceEvent();
        race.setRunner(owner);
        race.setName("Fall Marathon");
        race.setEventDate(LocalDate.of(2026, 11, 1));
        races.saveAndFlush(race);

        Map<String, String> files = export(owner, true);

        assertThat(files.keySet()).contains("README.txt", "profile.json", "runs.csv", "shoes.csv", "races.csv",
                "tracks/" + fileRun.getId() + ".gpx", "tracks/" + apiRun.getId() + ".gpx");
        assertThat(files.get("runs.csv")).contains("\"Tempo, with comma\"").doesNotContain("someone else's run");
        assertThat(files.get("shoes.csv")).contains("Nike", "Pegasus");
        assertThat(files.get("races.csv")).contains("Fall Marathon", "2026-11-01");
        assertThat(files.get("profile.json")).contains(owner.getEmail(), "Exporter");
        assertThat(files.keySet()).noneMatch(name -> name.startsWith("tracks/") && name.contains(String.valueOf(stranger.getId()) + "-"));
    }

    @Test
    void neverIncludesPasswordsOrTokens() throws IOException {
        Runner owner = runner();

        Map<String, String> files = export(owner, false);

        String everything = String.join("\n", files.values());
        assertThat(everything).doesNotContain("secret-access-token").doesNotContain("secret-refresh-token");
        assertThat(files.get("profile.json")).doesNotContainIgnoringCase("password").doesNotContainIgnoringCase("token");
    }

    @Test
    void labelsEachRunsSourceAndHowToReadItsStartTime() throws IOException {
        Runner owner = runner();
        run(owner, "from a file", ImportProvider.GARMIN, false);
        run(owner, "from the API", ImportProvider.STRAVA, true);

        String csv = export(owner, false).get("runs.csv");

        assertThat(csv).contains(",utc,GARMIN,").contains(",local,STRAVA_API,");
    }

    @Test
    void makesSpreadsheetFormulasInTextCellsInert() throws IOException {
        Runner owner = runner();
        run(owner, "=1+1", ImportProvider.GARMIN, false);
        run(owner, "@SUM(A1)", ImportProvider.GARMIN, false);
        run(owner, "-2+3", ImportProvider.GARMIN, false);

        String csv = export(owner, false).get("runs.csv");

        assertThat(csv).contains("'=1+1").contains("'@SUM(A1)").contains("'-2+3");
        assertThat(csv).doesNotContain(",=1+1,").doesNotContain(",@SUM(A1),");
    }

    @Test
    void tracksAreOptionalAndOffByDefault() throws IOException {
        Runner owner = runner();
        run(owner, "a run", ImportProvider.GARMIN, false);

        Map<String, String> files = export(owner, false);

        assertThat(files.keySet()).noneMatch(name -> name.startsWith("tracks/"));
        assertThat(files.get("README.txt")).contains("Not included");
    }

    @Test
    void trackFilesCarryHeartRateAndOnlyTrustworthyTimestamps() throws IOException {
        Runner owner = runner();
        Activity fileRun = run(owner, "utc run", ImportProvider.GARMIN, false);
        Activity apiRun = run(owner, "local-clock run", ImportProvider.STRAVA, true);

        Map<String, String> files = export(owner, true);
        String utcTrack = files.get("tracks/" + fileRun.getId() + ".gpx");
        String localTrack = files.get("tracks/" + apiRun.getId() + ".gpx");

        assertThat(utcTrack).contains("<gpxtpx:hr>140</gpxtpx:hr>").contains("<ele>12.5</ele>")
                .contains("<time>2026-10-01T07:30Z</time>");
        // The API run's start time is the runner's local clock, so writing it as UTC would be wrong.
        assertThat(localTrack).contains("<gpxtpx:hr>140</gpxtpx:hr>").doesNotContain("<time>");
    }

    @Test
    void escapesXmlInTrackNames() throws IOException {
        Runner owner = runner();
        Activity run = run(owner, "Tom & Jerry <fun run>", ImportProvider.GARMIN, false);

        String gpx = export(owner, true).get("tracks/" + run.getId() + ".gpx");

        assertThat(gpx).contains("Tom &amp; Jerry &lt;fun run&gt;").doesNotContain("<fun run>");
    }

    @Test
    void onlyOneExportRunsAtATime() {
        assertThat(exports.tryBegin()).isTrue();
        assertThat(exports.tryBegin()).as("a second export while one is running").isFalse();
        exports.end();
        assertThat(exports.tryBegin()).as("after the first one ends").isTrue();
        exports.end();
    }
}
