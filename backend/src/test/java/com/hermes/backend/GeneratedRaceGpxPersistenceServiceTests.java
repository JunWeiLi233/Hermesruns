package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeneratedRaceGpxPersistenceServiceTests {

    @Test
    void savePersistsRaceMetadataAndGpxPayload() {
        GeneratedRaceGpxAssetRepository repository = mock(GeneratedRaceGpxAssetRepository.class);
        Runner runner = new Runner();
        runner.setId(1L);
        when(repository.findByRaceId("boston-marathon")).thenReturn(Optional.empty());
        when(repository.save(any(GeneratedRaceGpxAsset.class))).thenAnswer(invocation -> {
            GeneratedRaceGpxAsset asset = invocation.getArgument(0);
            asset.setRaceId(asset.getRaceId());
            return asset;
        });

        GeneratedRaceGpxPersistenceService service = new GeneratedRaceGpxPersistenceService(repository);

        GeneratedRaceGpxAsset saved = service.save(
                runner,
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org/races/boston-marathon",
                42.195,
                "<gpx><trk><name>Boston Marathon</name></trk></gpx>"
        );

        verify(repository).save(any(GeneratedRaceGpxAsset.class));
        assertThat(saved.getRaceId()).isEqualTo("boston-marathon");
        assertThat(saved.getRaceName()).isEqualTo("Boston Marathon");
        assertThat(saved.getCity()).isEqualTo("Boston");
        assertThat(saved.getCountry()).isEqualTo("United States");
        assertThat(saved.getOfficialWebsite()).isEqualTo("https://www.baa.org/races/boston-marathon");
        assertThat(saved.getDistanceKm()).isEqualTo(42.195);
        assertThat(saved.getGpxXml()).contains("Boston Marathon");
    }

    @Test
    void saveUpdatesExistingRaceAssetForSameRaceId() {
        GeneratedRaceGpxAssetRepository repository = mock(GeneratedRaceGpxAssetRepository.class);
        Runner runner = new Runner();
        runner.setId(1L);
        GeneratedRaceGpxAsset existing = new GeneratedRaceGpxAsset();
        existing.setRaceId("tokyo-marathon");
        existing.setRaceName("Tokyo Marathon");
        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        GeneratedRaceGpxPersistenceService service = new GeneratedRaceGpxPersistenceService(repository);

        GeneratedRaceGpxAsset saved = service.save(
                runner,
                "tokyo-marathon",
                "Tokyo Marathon 2026",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                42.195,
                "<gpx><trk><name>Tokyo v2</name></trk></gpx>"
        );

        assertThat(saved).isSameAs(existing);
        assertThat(saved.getRaceName()).isEqualTo("Tokyo Marathon 2026");
        assertThat(saved.getGpxXml()).contains("Tokyo v2");
    }

    @Test
    void findByRaceIdReturnsEmptyWhenAssetDoesNotExist() {
        GeneratedRaceGpxAssetRepository repository = mock(GeneratedRaceGpxAssetRepository.class);
        when(repository.findByRaceId("missing-race")).thenReturn(Optional.empty());
        GeneratedRaceGpxPersistenceService service = new GeneratedRaceGpxPersistenceService(repository);

        assertThat(service.findByRaceId("missing-race")).isEmpty();
    }

    @Test
    void saveRejectsBlankRaceIdAndBlankGpxXml() {
        GeneratedRaceGpxPersistenceService service = new GeneratedRaceGpxPersistenceService(mock(GeneratedRaceGpxAssetRepository.class));
        Runner runner = new Runner();

        assertThatThrownBy(() -> service.save(runner, " ", "Race", "City", "Country", null, 42.195, "<gpx/>"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("raceId");
        assertThatThrownBy(() -> service.save(runner, "race-id", "Race", "City", "Country", null, 42.195, " "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("gpxXml");
    }
}
