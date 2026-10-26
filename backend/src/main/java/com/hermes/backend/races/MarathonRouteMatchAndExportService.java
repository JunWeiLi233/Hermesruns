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

    MarathonRouteMatchAndExportResult exportVerifiedCourse(
            Runner runner, String raceId, String raceName, String city, String country,
            String officialWebsite, Double distanceKm, TokyoCourseMapReference.Course course
    ) {
        return exportVerifiedCourse(runner, raceId, raceName, city, country, officialWebsite, distanceKm,
                new VerifiedCourseMap(TokyoMarathonOfficialCourse.OFFICIAL_SOURCE, TokyoCourseMapReference.SUMMARY,
                        course.sourceUrl(), course.routePoints(), course.elevationSamples(), course.totalClimbMeters()));
    }

    MarathonRouteMatchAndExportResult exportVerifiedCourse(
            Runner runner, String raceId, String raceName, String city, String country,
            String officialWebsite, Double distanceKm, VerifiedCourseMap course
    ) {
        List<RawBreadcrumbPointDTO> points = course.routePoints().stream()
                .map(point -> new RawBreadcrumbPointDTO(point.lat(), point.lng())).toList();
        String gpx = gpxExportService.exportTrack(raceName,
                course.summary() + " Source: " + course.sourceUrl(), points);
        GeneratedRaceGpxAsset asset = generatedRaceGpxPersistenceService.save(
                runner, raceId, raceName, city, country, officialWebsite, distanceKm, gpx);
        return new MarathonRouteMatchAndExportResult(points.stream()
                .map(point -> new MatchedBreadcrumbPointDTO(point.latitude(), point.longitude())).toList(),
                gpx, asset, course.summary());
    }
}
