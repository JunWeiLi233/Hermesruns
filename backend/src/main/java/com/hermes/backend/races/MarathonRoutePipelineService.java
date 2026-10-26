package com.hermes.backend.races;

import com.hermes.backend.races.model.ResolvedCandidateAsset;
import com.hermes.backend.runner.Runner;
import java.io.IOException;
import java.nio.file.Path;
import org.springframework.stereotype.Service;

@Service
public class MarathonRoutePipelineService {
    private final MarathonRouteExtractionService extractionService;
    private final MarathonRouteGeoreferencingService georeferencingService;
    private final MarathonRouteMatchAndExportService matchAndExportService;
    private final RaceCourseMapImageService imageService;

    public MarathonRoutePipelineService(
            MarathonRouteExtractionService extractionService,
            MarathonRouteGeoreferencingService georeferencingService,
            MarathonRouteMatchAndExportService matchAndExportService,
            RaceCourseMapImageService imageService
    ) {
        this.extractionService = extractionService;
        this.georeferencingService = georeferencingService;
        this.matchAndExportService = matchAndExportService;
        this.imageService = imageService;
    }

    public PipelineResult runPipeline(
            Runner runner,
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            String imageReference
        ) {
        return runPipeline(runner, raceId, raceName, city, country, officialWebsite, null, null, distanceKm, imageReference);
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
            String imageReference
        ) {
        // Recognise inline bytes only here: a request value is never a server file path.
        var official = imageReference != null && imageReference.startsWith("data:image/")
                ? VerifiedCourseMapReference.matchReference(imageReference, raceName, city, country, distanceKm)
                : java.util.Optional.<VerifiedCourseMap>empty();
        if (imageReference != null && imageReference.startsWith("local-course-map:")) {
            ResolvedCandidateAsset stored = imageService.resolveUploadedReference(imageReference);
            if (stored != null) {
                official = VerifiedCourseMapReference.match(stored.imageBytes(), raceName, city, country, distanceKm);
            }
        }
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

        // The admin request carries an image reference (data URL, stored
        // course-map reference or http URL), never a server path: resolve it
        // and hand the CV / Qwen steps a temp file this service created.
        ResolvedCandidateAsset image = imageService.resolveUploadedReference(imageReference);
        if (image == null || image.imageBytes() == null || image.imageBytes().length == 0) {
            throw new IllegalArgumentException("Could not load the course-map image for the pipeline.");
        }
        Path imageFile;
        try {
            imageFile = imageService.writePipelineImageFile(image.imageBytes());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to stage the course-map image for the pipeline.", ex);
        }
        try {
            return runPipelineOnImageFile(runner, raceId, raceName, city, country, officialWebsite,
                    latitude, longitude, distanceKm, imageFile.toString());
        } finally {
            imageService.deletePipelineImageFile(imageFile);
        }
    }

    private PipelineResult runPipelineOnImageFile(
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
