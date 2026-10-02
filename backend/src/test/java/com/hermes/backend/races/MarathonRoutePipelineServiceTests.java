package com.hermes.backend.races;

import com.hermes.backend.races.model.ResolvedCandidateAsset;
import com.hermes.backend.runner.Runner;
import java.nio.file.Path;
import java.util.Collections;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRoutePipelineServiceTests {
    private MarathonRouteExtractionService extractionService;
    private MarathonRouteGeoreferencingService georeferencingService;
    private MarathonRouteMatchAndExportService matchAndExportService;
    private RaceCourseMapImageService imageService;
    private MarathonRoutePipelineService pipelineService;
    private final Path stagedImage = Path.of(System.getProperty("java.io.tmpdir"), "hermes-route-staged.png");

    @BeforeEach
    void setUp() {
        extractionService = Mockito.mock(MarathonRouteExtractionService.class);
        georeferencingService = Mockito.mock(MarathonRouteGeoreferencingService.class);
        matchAndExportService = Mockito.mock(MarathonRouteMatchAndExportService.class);
        imageService = Mockito.mock(RaceCourseMapImageService.class);
        pipelineService = new MarathonRoutePipelineService(extractionService, georeferencingService, matchAndExportService, imageService);
    }

    private void stageImage(String imageReference) throws Exception {
        byte[] bytes = new byte[] {1, 2, 3};
        when(imageService.resolveUploadedReference(imageReference)).thenReturn(new ResolvedCandidateAsset(imageReference, bytes));
        when(imageService.writePipelineImageFile(bytes)).thenReturn(stagedImage);
    }

    @Test
    void testRunPipeline_Success() throws Exception {
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        stageImage("data:image/png;base64,AQID");

        // Mocking Step 1 & 2
        RouteParametersDTO routeParams = new RouteParametersDTO("#FF0000", Collections.emptyList());
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParams, Collections.emptyList(), 0, 0, 0);
        when(extractionService.extractRoutePath(any(), any(), any(), any(), any())).thenReturn(extractionResult);

        // Mocking Step 3
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParams, Collections.emptyList(), Collections.emptyList(), null, Collections.emptyList());
        when(georeferencingService.georeferenceRoute(any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(georefResult);

        // Mocking Step 4
        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult matchExportResult =
                new MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult(
                        Collections.emptyList(), "<gpx></gpx>", null, "Success");
        when(matchAndExportService.matchExportAndPersist(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(matchExportResult);

        MarathonRoutePipelineService.PipelineResult result = pipelineService.runPipeline(
                new Runner(),
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 52.5200, 13.4050, 42.195, "data:image/png;base64,AQID");

        assertNotNull(result);
        assertEquals(extractionResult, result.extractionResult());
        assertEquals(georefResult, result.georefResult());
        assertEquals(matchExportResult, result.matchExportResult());
        verify(extractionService).extractRoutePath(stagedImage.toString(), "Berlin Marathon", "Berlin", "Germany", 42.195);
        verify(georeferencingService).georeferenceRoute(
                stagedImage.toString(),
                "Berlin Marathon",
                "Berlin",
                "Germany",
                extractionResult,
                52.5200,
                13.4050,
                42.195
        );
        verify(imageService).deletePipelineImageFile(stagedImage);
    }

    @Test
    void testRunPipeline_NeverTreatsTheRequestReferenceAsAServerPath() {
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        when(imageService.resolveUploadedReference("/etc/passwd")).thenReturn(null);

        assertThatThrownBy(() -> pipelineService.runPipeline(
                new Runner(),
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 52.5200, 13.4050, 42.195, "/etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Could not load the course-map image");

        verify(extractionService, never()).extractRoutePath(any(), any(), any(), any(), any());
    }

    @Test
    void testRunPipeline_DeletesTheStagedImageWhenAStepFails() throws Exception {
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        stageImage("local-course-map:berlin.png");
        when(extractionService.extractRoutePath(any(), any(), any(), any(), any())).thenThrow(new IllegalStateException("cv failed"));

        assertThatThrownBy(() -> pipelineService.runPipeline(
                new Runner(),
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 52.5200, 13.4050, 42.195, "local-course-map:berlin.png"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cv failed");

        verify(imageService).deletePipelineImageFile(stagedImage);
    }

    @Test
    void testRunPipeline_FailsFastWhenGeoreferencingIsDisabled() {
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(false);

        assertThatThrownBy(() -> pipelineService.runPipeline(
                new Runner(),
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 52.5200, 13.4050, 42.195, "path/to/img.png"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("disabled");

        verify(extractionService, never()).extractRoutePath(any(), any(), any(), any(), any());
        verify(imageService, never()).resolveUploadedReference(any());
        verify(matchAndExportService, never()).matchExportAndPersist(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
