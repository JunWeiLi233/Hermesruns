package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Strava's account export stores activity files as {@code .fit.gz}. A gzipped workout file imports like
 * the plain file, and the expansion is bounded: a few kilobytes of gzip can hold gigabytes.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-import-gzip;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ActivityImportGzipTests {

    private static final String GPX = """
            <?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
              <trk><name>Morning Run</name><type>running</type><trkseg>
                <trkpt lat="40.7000" lon="-74.0000"><ele>10</ele><time>2026-10-01T11:30:00Z</time></trkpt>
                <trkpt lat="40.7010" lon="-74.0000"><ele>11</ele><time>2026-10-01T11:31:00Z</time></trkpt>
                <trkpt lat="40.7020" lon="-74.0000"><ele>12</ele><time>2026-10-01T11:32:00Z</time></trkpt>
              </trkseg></trk>
            </gpx>
            """;

    @Autowired private ActivityImportService importService;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("gzip-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private static byte[] gzip(byte[] plain) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
            gzip.write(plain);
        }
        return out.toByteArray();
    }

    private static byte[] gzip(String text) throws IOException {
        return gzip(text.getBytes(StandardCharsets.UTF_8));
    }

    private static MockMultipartFile upload(String name, byte[] bytes) {
        return new MockMultipartFile("exports", name, "application/octet-stream", bytes);
    }

    // --- the importer ----------------------------------------------------------------------------------------

    @Test
    void aGzippedWorkoutFileImportsLikeThePlainFile() throws Exception {
        Runner owner = runner();

        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN, upload("morning.gpx.gz", gzip(GPX)));

        assertThat(result.importedActivities()).isEqualTo(1);
        assertThat(result.importedPoints()).isEqualTo(3);
        List<Activity> saved = activities.findAll().stream().filter(a -> a.getRunner().getId().equals(owner.getId())).toList();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getName()).isEqualTo("Morning Run");
        assertThat(saved.get(0).getSourceFileName()).as("the name of the file inside the .gz").isEqualTo("morning.gpx");
    }

    @Test
    void theSameRunImportedPlainAndGzippedIsOneRun() throws Exception {
        Runner owner = runner();

        ImportResult gzipped = importService.importFile(owner, ImportProvider.GARMIN, upload("morning.gpx.gz", gzip(GPX)));
        ImportResult plain = importService.importFile(owner, ImportProvider.GARMIN,
                upload("morning.gpx", GPX.getBytes(StandardCharsets.UTF_8)));

        assertThat(gzipped.importedActivities()).isEqualTo(1);
        assertThat(plain.importedActivities()).isZero();
        assertThat(plain.skippedDuplicates()).isEqualTo(1);
    }

    @Test
    void anUpperCaseGzSuffixIsAccepted() throws Exception {
        ImportResult result = importService.importFile(runner(), ImportProvider.GARMIN, upload("MORNING.GPX.GZ", gzip(GPX)));

        assertThat(result.importedActivities()).isEqualTo(1);
    }

    @Test
    void gzippedWorkoutFilesInsideAZipAreImported() throws Exception {
        Runner owner = runner();
        ByteArrayOutputStream zipped = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(zipped)) {
            zip.putNextEntry(new ZipEntry("activities/1.gpx.gz"));
            zip.write(gzip(GPX));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("activities/notes.txt.gz"));
            zip.write(gzip("not a workout"));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("media/photo.jpg"));
            zip.write(new byte[] {1, 2, 3});
            zip.closeEntry();
        }

        ImportResult result = importService.importFile(owner, ImportProvider.GARMIN, upload("strava-export.zip", zipped.toByteArray()));

        assertThat(result.importedActivities()).isEqualTo(1);
    }

    @Test
    void aGzThatDoesNotHoldAWorkoutFileIsRejected() throws Exception {
        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("notes.txt.gz", gzip("hello"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("GPX, TCX, or FIT");
        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("archive.gz", gzip("hello"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("GPX, TCX, or FIT");
    }

    @Test
    void aFileThatIsNotReallyGzipIsRejectedWithAClearMessage() {
        byte[] notGzip = "this is plain text, not gzip".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("fake.gpx.gz", notGzip)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid or corrupt .gz file.");
    }

    @Test
    void aTruncatedGzipIsRejectedWithAClearMessage() throws Exception {
        byte[] whole = gzip(GPX);
        byte[] truncated = java.util.Arrays.copyOf(whole, whole.length / 2);

        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("cut.gpx.gz", truncated)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid or corrupt .gz file.");
    }

    @Test
    void aDecompressionBombIsStoppedAtTheLimit() throws Exception {
        // 11 MB of zeros gzips to about 11 KB: tiny to upload, over the 10 MB limit once expanded.
        byte[] bomb = gzip(new byte[11 * 1024 * 1024]);
        assertThat(bomb.length).as("the fixture really is a small file").isLessThan(100 * 1024);

        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("bomb.gpx.gz", bomb)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("too large")
                .hasMessageContaining("10MB");
    }

    @Test
    void aBombInsideAZipIsStoppedToo() throws Exception {
        byte[] bomb = gzip(new byte[11 * 1024 * 1024]);
        ByteArrayOutputStream zipped = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(zipped)) {
            zip.putNextEntry(new ZipEntry("bomb.fit.gz"));
            zip.write(bomb);
            zip.closeEntry();
        }

        assertThatThrownBy(() -> importService.importFile(runner(), ImportProvider.GARMIN, upload("bomb.zip", zipped.toByteArray())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("too large");
    }

    // --- the controller's file-type gate ---------------------------------------------------------------------

    private ResponseEntity<?> uploadThroughController(String name, ActivityImportService service) {
        AuthService authService = mock(AuthService.class);
        Runner runner = new Runner();
        runner.setId(1L);
        when(authService.findByAuthorizationHeader("Bearer valid")).thenReturn(Optional.of(runner));
        ImportController controller = new ImportController(authService, service);
        return controller.importFile("Bearer valid", "garmin", upload(name, new byte[] {1, 2, 3}));
    }

    @Test
    void theControllerAcceptsGzippedWorkoutFilesAndNothingElseGzipped() {
        ActivityImportService service = mock(ActivityImportService.class);
        when(service.importFile(any(), eq(ImportProvider.GARMIN), any()))
                .thenReturn(new ImportResult("GARMIN", 1, 3, 0, 0, "ok", List.of()));

        for (String accepted : new String[] {"run.fit.gz", "run.gpx.gz", "run.tcx.gz", "RUN.FIT.GZ", "activities/run.fit.gz"}) {
            assertThat(uploadThroughController(accepted, service).getStatusCode()).as(accepted).isEqualTo(HttpStatus.OK);
        }
        for (String rejected : new String[] {"run.gz", "run.txt.gz", "run.zip.gz", "run.fit.gz.bak", ".gz"}) {
            assertThat(uploadThroughController(rejected, service).getStatusCode()).as(rejected).isEqualTo(HttpStatus.BAD_REQUEST);
        }
        verify(service, never()).importFile(any(), eq(ImportProvider.GARMIN),
                org.mockito.ArgumentMatchers.argThat(file -> file.getOriginalFilename().endsWith(".txt.gz")));
    }
}
