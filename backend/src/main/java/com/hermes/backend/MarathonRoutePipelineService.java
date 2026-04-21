package com.hermes.backend;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class MarathonRoutePipelineService {
    private final MarathonRouteExtractionService extractionService;
    private final MarathonRouteGeoreferencingService georeferencingService;
    private final MarathonRouteMatchAndExportService matchAndExportService;

    public MarathonRoutePipelineService(
            MarathonRouteExtractionService extractionService,
            MarathonRouteGeoreferencingService georeferencingService,
            MarathonRouteMatchAndExportService matchAndExportService
    ) {
        this.extractionService = extractionService;
        this.georeferencingService = georeferencingService;
        this.matchAndExportService = matchAndExportService;
    }

    public PipelineResult runPipeline(
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            String imageFilePath
    ) {
        // Step 1 & 2: Route Extraction (Java + Python)
        RoutePathExtractionResultDTO extractionResult = extractionService.extractRoutePath(imageFilePath);

        // Step 3: Georeferencing (Gemini + Google)
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult = 
            georeferencingService.georeferenceRoute(imageFilePath, raceName, city, country, extractionResult);

        // Step 4: Map Matching & Export (OSRM + Persistence)
        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult matchExportResult =
            matchAndExportService.matchExportAndPersist(
                raceId, raceName, city, country, officialWebsite, distanceKm, georefResult.rawBreadcrumbs());

        return new PipelineResult(
            extractionResult,
            georefResult,
            matchExportResult
        );
    }

    public record PipelineResult(
        RoutePathExtractionResultDTO extractionResult,
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult,
        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult matchExportResult
    ) {}
}
