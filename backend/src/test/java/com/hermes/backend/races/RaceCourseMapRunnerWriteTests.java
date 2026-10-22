package com.hermes.backend.races;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.races.RaceCourseMapBulkSeedService.CatalogRace;
import com.hermes.backend.races.RaceCourseMapBulkSeedService.SeedOutcome;
import com.hermes.backend.runner.Runner;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for runner-triggered catalog writes: a runner request may never choose the
 * catalog identity written for a race id. Only a server-side catalog entry may seed, and its own
 * values are used; an unknown id is resolved without writing.
 */
class RaceCourseMapRunnerWriteTests {

    @Test
    void runnerRequestIsRoutedToCatalogScopedResolution() {
        AuthService authService = mock(AuthService.class);
        Runner runner = new Runner();
        runner.setRole("USER");
        when(authService.findByAuthorizationHeader("Bearer runner")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);

        RaceCourseMapService service = mock(RaceCourseMapService.class);
        when(service.resolveCourseMapWithStorageForRunner(
                anyString(), any(), any(), any(), any(), any(), any(), any())).thenReturn(emptyResult());
        RaceController controller = new RaceController(authService,
                mock(RaceEventService.class), mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class), service);

        controller.courseMap("Bearer runner", "attacker-race-1", "ATTACKER", "CITY", "XX",
                "https://attacker.example/", 1.0, 2.0, 42.0);

        verify(service, never()).resolveCourseMapWithStorage(
                anyString(), any(), any(), any(), any(), any(), any(), any());
        verify(service).resolveCourseMapWithStorageForRunner(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void adminRequestKeepsTheStoragePath() {
        AuthService authService = mock(AuthService.class);
        Runner admin = new Runner();
        admin.setRole("ADMIN");
        when(authService.findByAuthorizationHeader("Bearer admin")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);

        RaceCourseMapService service = mock(RaceCourseMapService.class);
        when(service.resolveCourseMapWithStorage(
                anyString(), any(), any(), any(), any(), any(), any(), any())).thenReturn(emptyResult());
        RaceController controller = new RaceController(authService,
                mock(RaceEventService.class), mock(RaceOfficialImageService.class),
                mock(RaceElevationProfileService.class), service);

        controller.courseMap("Bearer admin", "admin-race-1", "NAME", "CITY", "XX",
                "https://example.test/", 1.0, 2.0, 42.0);

        verify(service).resolveCourseMapWithStorage(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void seedingUsesCatalogValuesNotRequestValues() {
        RaceCourseMapBulkSeedService seed = mock(RaceCourseMapBulkSeedService.class);
        CatalogRace catalogRace = new CatalogRace("known-race", "CATALOG NAME", "org",
                "https://official.example/", "CATALOG CITY", "CC", "Catalog City, CC",
                42.0, null, "", 10.0, 20.0, null);
        when(seed.findCatalogRace("known-race")).thenReturn(Optional.of(catalogRace));
        List<CatalogRace> seeded = new ArrayList<>();
        when(seed.seedRace(any(CatalogRace.class), anyString(), anyBoolean())).thenAnswer(invocation -> {
            seeded.add(invocation.getArgument(0));
            return SeedOutcome.SEEDED;
        });

        RaceCourseMapService service = serviceWithSeed(seed);
        try {
            service.resolveCourseMapWithStorageForRunner("known-race", "ATTACKER NAME", "ATTACKER CITY",
                    "XX", "https://attacker.example/", 1.0, 2.0, 10.0);
        } catch (RuntimeException ignored) {
            // The probe stops at the writer; downstream rendering is not part of this invariant.
        }

        assertThat(seeded).hasSize(1);
        assertThat(seeded.get(0).name()).isEqualTo("CATALOG NAME");
        assertThat(seeded.get(0).latitude()).isEqualTo(10.0);
        assertThat(seeded.get(0).longitude()).isEqualTo(20.0);
    }

    @Test
    void unknownRaceIdIsNeverSeeded() {
        RaceCourseMapBulkSeedService seed = mock(RaceCourseMapBulkSeedService.class);
        when(seed.findCatalogRace("unknown-race")).thenReturn(Optional.empty());

        RaceCourseMapService service = serviceWithSeed(seed);
        try {
            service.resolveCourseMapWithStorageForRunner("unknown-race", "ATTACKER NAME", "ATTACKER CITY",
                    "XX", "https://attacker.example/", 1.0, 2.0, 10.0);
        } catch (RuntimeException ignored) {
            // Read-only resolution may fail without provider configuration; the invariant is no write.
        }

        verify(seed, never()).seedRace(any(CatalogRace.class), anyString(), anyBoolean());
    }

    private static RaceCourseMapService serviceWithSeed(RaceCourseMapBulkSeedService seed) {
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(repository.findByRaceId(anyString())).thenReturn(Optional.empty());
        RaceCourseMapService service = new RaceCourseMapService(
                mock(RestTemplate.class),
                new com.fasterxml.jackson.databind.ObjectMapper(),
                mock(com.hermes.backend.infrastructure.config.SystemConfigService.class),
                repository,
                mock(RaceCourseMapGeometryService.class),
                mock(RaceCourseMapSearchService.class),
                mock(RaceCourseMapImageService.class),
                mock(RaceCourseMapAiService.class));
        service.setBulkSeedService(seed);
        return service;
    }

    private static RaceCourseMapResult emptyResult() {
        return new RaceCourseMapResult("", "", false, 0, "", null,
                List.of(), List.of(), null, false, null);
    }
}
