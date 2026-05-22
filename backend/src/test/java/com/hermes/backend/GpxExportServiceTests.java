package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GpxExportServiceTests {

    private final GpxExportService service = new GpxExportService();

    @Test
    void exportTrackBuildsDeterministicGpxXmlWithMetadataAndOrderedTrackPoints() {
        String xml = service.exportTrack(
                "Boston Marathon",
                "Approximate matched route",
                List.of(
                        new RawBreadcrumbPointDTO(42.349203, -71.078423),
                        new RawBreadcrumbPointDTO(42.350102, -71.074981),
                        new RawBreadcrumbPointDTO(42.351844, -71.071114)
                )
        );

        assertThat(xml).isEqualTo("""
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" creator="Hermes" xmlns="http://www.topografix.com/GPX/1/1">
                  <trk>
                    <name>Boston Marathon</name>
                    <desc>Approximate matched route</desc>
                    <trkseg>
                      <trkpt lat="42.349203" lon="-71.078423"></trkpt>
                      <trkpt lat="42.350102" lon="-71.074981"></trkpt>
                      <trkpt lat="42.351844" lon="-71.071114"></trkpt>
                    </trkseg>
                  </trk>
                </gpx>
                """);
    }

    @Test
    void exportTrackOmitsDescriptionElementWhenBlankAndEscapesXmlSensitiveCharacters() {
        String xml = service.exportTrack(
                "Rock & Roll <Marathon>",
                "   ",
                List.of(new RawBreadcrumbPointDTO(35.123456, -80.654321))
        );

        assertThat(xml).contains("<name>Rock &amp; Roll &lt;Marathon&gt;</name>");
        assertThat(xml).doesNotContain("<desc>");
        assertThat(xml).contains("<trkpt lat=\"35.123456\" lon=\"-80.654321\"></trkpt>");
    }

    @Test
    void exportTrackRejectsBlankRaceName() {
        assertThatThrownBy(() -> service.exportTrack(
                " ",
                null,
                List.of(new RawBreadcrumbPointDTO(42.0, -71.0))
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Race name is required.");
    }

    @Test
    void exportTrackRejectsEmptyBreadcrumbs() {
        assertThatThrownBy(() -> service.exportTrack(
                "Boston Marathon",
                null,
                List.of()
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("At least one breadcrumb is required.");
    }
}
