package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import java.util.Base64;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class TokyoCourseMapWorkflowTests {
    @Test
    void boundedPdfRenderingPreservesVerifiedTokyoReference() throws Exception {
        byte[] pdf=getClass().getResourceAsStream("/course-maps/tokyo-2026.pdf").readAllBytes();
        var image=new RaceCourseMapImageService(new org.springframework.web.client.RestTemplate()).resolveUploadedReference(
                "data:application/pdf;base64,"+Base64.getEncoder().encodeToString(pdf));
        String hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(image.imageBytes()));
        assertThat(VerifiedCourseMapReference.match(image.imageBytes(),"Tokyo Marathon","Tokyo","Japan",42.195))
                .as("Bounded PDF preview SHA256 %s",hash).isPresent();
    }
    @Test
    void recognizedOfficialImageExportsVerifiedGpxWithoutAffineOrDrivingRematch() throws Exception {
        var extraction = mock(MarathonRouteExtractionService.class);
        var georeferencing = mock(MarathonRouteGeoreferencingService.class);
        var matching = mock(OsrmMapMatchingClient.class);
        var persistence = mock(GeneratedRaceGpxPersistenceService.class);
        when(persistence.save(any(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString()))
                .thenAnswer(invocation -> {
                    var asset = new GeneratedRaceGpxAsset();
                    asset.setRaceId(invocation.getArgument(1));
                    asset.setGpxXml(invocation.getArgument(7));
                    return asset;
                });
        var exporter = new MarathonRouteMatchAndExportService(matching, new GpxExportService(), persistence);
        var pipeline = new MarathonRoutePipelineService(extraction, georeferencing, exporter);

        var result = pipeline.runPipeline(new Runner(), "tokyo-marathon", "Tokyo Marathon", "Tokyo", "Japan",
                "https://www.marathon.tokyo", 35.6762, 139.6503, 42.195, imageDataUrl());

        assertThat(result.matchExportResult().matchedBreadcrumbs()).hasSize(600);
        String gpx = result.matchExportResult().gpxXml();
        assertThat(gpx).contains("35.690272", "139.691507", "35.681498", "139.764924");
        assertThat(gpx.split("<trkpt ").length - 1).isEqualTo(600);
        assertThat(result.matchExportResult().persistedAsset().getRaceId()).isEqualTo("tokyo-marathon");
        assertThat(result.matchExportResult().matchingSemanticsNote()).contains("verified official Tokyo Marathon 2026");
        verifyNoInteractions(extraction, georeferencing, matching);
    }

    @Test
    void officialTokyoImageDoesNotSupplyGeometryForAnotherRace() throws Exception {
        var pipeline = new MarathonRoutePipelineService(mock(MarathonRouteExtractionService.class),
                mock(MarathonRouteGeoreferencingService.class), mock(MarathonRouteMatchAndExportService.class));
        assertThatThrownBy(() -> pipeline.runPipeline(new Runner(), "berlin-marathon", "Berlin Marathon", "Berlin", "Germany",
                "https://example.com", 52.5, 13.4, 42.195, imageDataUrl())).hasMessageContaining("disabled");
    }

    @Test
    void metadataCannotTurnAnUnknownOrChangedImageIntoTheVerifiedCourse() throws Exception {
        String image = imageDataUrl();
        assertThat(TokyoCourseMapReference.matchReference(image, "Tokyo Marathon", "Tokyo", "Japan", 10.7)).isEmpty();
        assertThat(TokyoCourseMapReference.matchReference(image, "Tokyo Marathon", "Tokyo", "France", 42.195)).isEmpty();
        byte[] changed = Base64.getDecoder().decode(image.substring(image.indexOf(',') + 1));
        changed[changed.length - 1] ^= 1;
        assertThat(TokyoCourseMapReference.match(changed, "Tokyo Marathon", "Tokyo", "Japan", 42.195)).isEmpty();
        assertThat(TokyoCourseMapReference.match("Tokyo Marathon 2026".getBytes(), "Tokyo Marathon", "Tokyo", "Japan", 42.195)).isEmpty();
    }

    private String imageDataUrl() throws Exception {
        try (var stream = getClass().getResourceAsStream("/course-maps/tokyo-2026.png")) {
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(stream.readAllBytes());
        }
    }
}
