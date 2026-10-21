package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import org.springframework.stereotype.Service;

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
            Runner runner,
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            String imageFilePath
        ) {
        return runPipeline(runner, raceId, raceName, city, country, officialWebsite, null, null, distanceKm, imageFilePath);
    }

    public PipelineResult runPipeline(
            Runner runner,
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String imageFilePath
        ) {
        var official = VerifiedCourseMapReference.matchReference(imageFilePath, raceName, city, country, distanceKm);
        if (official.isPresent() && (("tokyo-marathon".equals(raceId) && TokyoMarathonOfficialCourse.OFFICIAL_SOURCE.equals(official.get().source()))
                || ("amsterdam-marathon".equals(raceId) && AmsterdamMarathonOfficialCourse.OFFICIAL_SOURCE.equals(official.get().source()))
                || ("verified-official-map:"+raceId).equals(official.get().source())
                || ("reviewed-source-map:"+raceId).equals(official.get().source()))) {
            // A schematic cannot be projected by one affine transform. Its
            // recognized official course already has verified street geometry.
            var exported = matchAndExportService.exportVerifiedCourse(runner, raceId, raceName, city, country,
                    officialWebsite, distanceKm, official.get());
            return new PipelineResult(null, null, exported);
        }
        if (!georeferencingService.isConfiguredForPipelineFallback()) {
            throw new IllegalStateException("Marathon route pipeline is disabled while Google geocoding is removed.");
        }

        // Step 1 & 2: Route Extraction (Java + Python)
        RoutePathExtractionResultDTO extractionResult = extractionService.extractRoutePath(
                imageFilePath,
                raceName,
                city,
                country,
                distanceKm
        );

        // Step 3: Georeferencing (Qwen + Google)
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult = 
            georeferencingService.georeferenceRoute(imageFilePath, raceName, city, country, extractionResult, latitude, longitude, distanceKm);

        // Step 4: Map Matching & Export (OSRM + Persistence)
        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult matchExportResult =
            matchAndExportService.matchExportAndPersist(
                runner, raceId, raceName, city, country, officialWebsite, distanceKm, georefResult.rawBreadcrumbs());

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
