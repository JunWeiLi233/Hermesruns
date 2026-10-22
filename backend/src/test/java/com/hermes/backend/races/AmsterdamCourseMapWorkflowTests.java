package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AmsterdamCourseMapWorkflowTests {
    @Test
    void recognizedAmsterdamSourceExportsCheckedGeometryWithoutAffineProjection() throws Exception {
        byte[] original = getClass().getResourceAsStream("/course-maps/amsterdam-2025.jpg").readAllBytes();
        String source = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(original);
        var normalized = new RaceCourseMapImageService(mock(RestTemplate.class)).resolveUploadedReference(source);
        System.out.println("Amsterdam normalized SHA-256: " + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized.imageBytes())));
        for (String image : new String[]{source, "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(normalized.imageBytes())}) {
            var extraction = mock(MarathonRouteExtractionService.class);
            var georeferencing = mock(MarathonRouteGeoreferencingService.class);
            var matching = mock(OsrmMapMatchingClient.class);
            var persistence = mock(GeneratedRaceGpxPersistenceService.class);
            when(persistence.save(any(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString()))
                    .thenAnswer(invocation -> new GeneratedRaceGpxAsset());
            var pipeline = new MarathonRoutePipelineService(extraction, georeferencing,
                    new MarathonRouteMatchAndExportService(matching, new GpxExportService(), persistence), mock(RaceCourseMapImageService.class));
            var result = pipeline.runPipeline(new Runner(), "amsterdam-marathon", "Amsterdam Marathon", "Amsterdam", "Netherlands",
                    AmsterdamMarathonOfficialCourse.OFFICIAL_COURSE_URL, 52.3676, 4.9041, 42.195, image);
            var points = result.matchExportResult().matchedBreadcrumbs();
            assertThat(points).hasSize(543);
            assertThat(result.matchExportResult().matchingSemanticsNote()).contains("Amsterdam", "2025");
            assertThat(result.matchExportResult().gpxXml().split("<trkpt ").length - 1).isEqualTo(543);
            verifyNoInteractions(extraction, georeferencing, matching);
        }
    }

    @Test
    void amsterdamImageCannotSupplyGeometryForAnotherRaceOrDistance() throws Exception {
        byte[] bytes = getClass().getResourceAsStream("/course-maps/amsterdam-2025.jpg").readAllBytes();
        String source = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(bytes);
        var pipeline = new MarathonRoutePipelineService(mock(MarathonRouteExtractionService.class),
                mock(MarathonRouteGeoreferencingService.class), mock(MarathonRouteMatchAndExportService.class), mock(RaceCourseMapImageService.class));
        assertThatThrownBy(() -> pipeline.runPipeline(new Runner(), "tokyo-marathon", "Tokyo Marathon", "Tokyo", "Japan", "", 42.195, source)).hasMessageContaining("disabled");
        assertThatThrownBy(() -> pipeline.runPipeline(new Runner(), "amsterdam-marathon", "Amsterdam Marathon", "Amsterdam", "Netherlands", "", 21.1, source)).hasMessageContaining("disabled");
    }
}
