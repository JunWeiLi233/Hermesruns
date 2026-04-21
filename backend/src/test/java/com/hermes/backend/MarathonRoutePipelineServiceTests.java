package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
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
        // Mocking Step 1 & 2
        RouteParametersDTO routeParams = new RouteParametersDTO("#FF0000", Collections.emptyList());
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParams, Collections.emptyList(), 0, 0, 0);
        when(extractionService.extractRoutePath(any())).thenReturn(extractionResult);

        // Mocking Step 3
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParams, Collections.emptyList(), Collections.emptyList(), null, Collections.emptyList());
        when(georeferencingService.georeferenceRoute(any(), any(), any(), any(), any())).thenReturn(georefResult);

        // Mocking Step 4
        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult matchExportResult =
                new MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult(
                        Collections.emptyList(), "<gpx></gpx>", null, "Success");
        when(matchAndExportService.matchExportAndPersist(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(matchExportResult);

        MarathonRoutePipelineService.PipelineResult result = pipelineService.runPipeline(
                "race-123", "Berlin Marathon", "Berlin", "Germany", "https://berlin.com", 42.195, "path/to/img.png");

        assertNotNull(result);
        assertEquals(extractionResult, result.extractionResult());
        assertEquals(georefResult, result.georefResult());
        assertEquals(matchExportResult, result.matchExportResult());
    }
}
