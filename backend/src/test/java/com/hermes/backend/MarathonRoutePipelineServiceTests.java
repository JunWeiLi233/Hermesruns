package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRoutePipelineServiceTests {
    private MarathonRouteExtractionService extractionService;
    private MarathonRouteGeoreferencingService georeferencingService;
    private MarathonRouteMatchAndExportService matchAndExportService;
    private MarathonRoutePipelineService pipelineService;

    @BeforeEach
    void setUp() {
        extractionService = Mockito.mock(MarathonRouteExtractionService.class);
        georeferencingService = Mockito.mock(MarathonRouteGeoreferencingService.class);
        matchAndExportService = Mockito.mock(MarathonRouteMatchAndExportService.class);
        pipelineService = new MarathonRoutePipelineService(extractionService, georeferencingService, matchAndExportService);
    }

    @Test
    void testRunPipeline_Success() {
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);

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
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 52.5200, 13.4050, 42.195, "path/to/img.png");

        assertNotNull(result);
        assertEquals(extractionResult, result.extractionResult());
        assertEquals(georefResult, result.georefResult());
        assertEquals(matchExportResult, result.matchExportResult());
        verify(georeferencingService).georeferenceRoute(
                "path/to/img.png",
                "Berlin Marathon",
                "Berlin",
                "Germany",
                extractionResult,
                52.5200,
                13.4050,
                42.195
        );
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
        verify(matchAndExportService, never()).matchExportAndPersist(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
