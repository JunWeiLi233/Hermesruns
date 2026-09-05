package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class MarathonRouteMatchAndExportService {
    private final OsrmMapMatchingClient osrmMapMatchingClient;
    private final GpxExportService gpxExportService;
    private final GeneratedRaceGpxPersistenceService generatedRaceGpxPersistenceService;

    public MarathonRouteMatchAndExportService(
            OsrmMapMatchingClient osrmMapMatchingClient,
            GpxExportService gpxExportService,
            GeneratedRaceGpxPersistenceService generatedRaceGpxPersistenceService
    ) {
        this.osrmMapMatchingClient = osrmMapMatchingClient;
        this.gpxExportService = gpxExportService;
        this.generatedRaceGpxPersistenceService = generatedRaceGpxPersistenceService;
    }

    public MarathonRouteMatchAndExportResult matchExportAndPersist(
            Runner runner,
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double distanceKm,
            List<RawBreadcrumbPointDTO> rawBreadcrumbs
    ) {
        List<MatchedBreadcrumbPointDTO> matchedBreadcrumbs = osrmMapMatchingClient.matchOrderedBreadcrumbs(rawBreadcrumbs);
        List<RawBreadcrumbPointDTO> matchedAsRaw = matchedBreadcrumbs.stream()
                .map(point -> new RawBreadcrumbPointDTO(point.latitude(), point.longitude()))
                .toList();
        String gpxXml = gpxExportService.exportTrack(raceName, "OSRM matched marathon route", matchedAsRaw);
        GeneratedRaceGpxAsset persistedAsset = generatedRaceGpxPersistenceService.save(
                runner,
                raceId,
                raceName,
                city,
                country,
                officialWebsite,
                distanceKm,
                gpxXml
        );
        return new MarathonRouteMatchAndExportResult(
                matchedBreadcrumbs,
                gpxXml,
                persistedAsset,
                osrmMapMatchingClient.matchingSemanticsNote()
        );
    }

    public record MarathonRouteMatchAndExportResult(
            List<MatchedBreadcrumbPointDTO> matchedBreadcrumbs,
            String gpxXml,
            GeneratedRaceGpxAsset persistedAsset,
            String matchingSemanticsNote
    ) {}
}
