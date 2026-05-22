package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarathonRouteMatchAndExportServiceTests {

    @Test
    void matchExportAndPersistCoordinatesTheStep4Services() {
        OsrmMapMatchingClient osrmMapMatchingClient = mock(OsrmMapMatchingClient.class);
        GpxExportService gpxExportService = mock(GpxExportService.class);
        GeneratedRaceGpxPersistenceService persistenceService = mock(GeneratedRaceGpxPersistenceService.class);
        Runner runner = new Runner();
        runner.setId(1L);

        List<RawBreadcrumbPointDTO> rawBreadcrumbs = List.of(
                new RawBreadcrumbPointDTO(42.349203, -71.078423),
                new RawBreadcrumbPointDTO(42.350102, -71.074981)
        );
        List<MatchedBreadcrumbPointDTO> matchedBreadcrumbs = List.of(
                new MatchedBreadcrumbPointDTO(42.349200, -71.078400),
                new MatchedBreadcrumbPointDTO(42.350100, -71.075000)
        );
        List<RawBreadcrumbPointDTO> matchedAsRaw = List.of(
                new RawBreadcrumbPointDTO(42.349200, -71.078400),
                new RawBreadcrumbPointDTO(42.350100, -71.075000)
        );
        String gpxXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1"></gpx>
                """;
        GeneratedRaceGpxAsset persisted = new GeneratedRaceGpxAsset();
        persisted.setRaceId("boston-marathon");
        persisted.setRaceName("Boston Marathon");
        persisted.setCity("Boston");
        persisted.setCountry("United States");
        persisted.setOfficialWebsite("https://www.baa.org");
        persisted.setDistanceKm(42.195);
        persisted.setGpxXml(gpxXml);

        when(osrmMapMatchingClient.matchOrderedBreadcrumbs(rawBreadcrumbs)).thenReturn(matchedBreadcrumbs);
        when(gpxExportService.exportTrack("Boston Marathon", "OSRM matched marathon route", matchedAsRaw)).thenReturn(gpxXml);
        when(persistenceService.save(
                runner,
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.195,
                gpxXml
        )).thenReturn(persisted);
        when(osrmMapMatchingClient.matchingSemanticsNote()).thenReturn("OSRM scaffold note");

        MarathonRouteMatchAndExportService service = new MarathonRouteMatchAndExportService(
                osrmMapMatchingClient,
                gpxExportService,
                persistenceService
        );

        MarathonRouteMatchAndExportService.MarathonRouteMatchAndExportResult result = service.matchExportAndPersist(
                runner,
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.195,
                rawBreadcrumbs
        );

        verify(osrmMapMatchingClient).matchOrderedBreadcrumbs(rawBreadcrumbs);
        verify(gpxExportService).exportTrack("Boston Marathon", "OSRM matched marathon route", matchedAsRaw);
        verify(persistenceService).save(
                runner,
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.195,
                gpxXml
        );

        assertThat(result.matchedBreadcrumbs()).containsExactlyElementsOf(matchedBreadcrumbs);
        assertThat(result.gpxXml()).isEqualTo(gpxXml);
        assertThat(result.persistedAsset()).isEqualTo(persisted);
        assertThat(result.matchingSemanticsNote()).contains("OSRM");
    }
}
