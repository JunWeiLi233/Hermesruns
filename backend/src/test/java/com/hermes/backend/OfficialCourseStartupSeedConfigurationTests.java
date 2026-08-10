package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationRunner;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OfficialCourseStartupSeedConfigurationTests {

    @Test
    void startupSeederIncludesEveryHardcodedOfficialCourse() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        when(assetRepository.findByRaceId(anyString())).thenReturn(Optional.empty());
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService, times(11)).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getAllValues())
                .extracting(RaceCourseMapBulkSeedService.CatalogRace::id)
                .containsExactly(
                        NycMarathonOfficialCourse.RACE_ID,
                        BostonMarathonOfficialCourse.RACE_ID,
                        ChicagoMarathonKnownCourse.RACE_ID,
                        TokyoMarathonOfficialCourse.RACE_ID,
                        LosAngelesMarathonOfficialCourse.RACE_ID,
                        OsakaMarathonOfficialCourse.RACE_ID,
                        AthensMarathonOfficialCourse.RACE_ID,
                        WuxiMarathonOfficialCourse.RACE_ID,
                        BerlinMarathonOfficialCourse.RACE_ID,
                        BergenCityMarathonOfficialCourse.RACE_ID,
                        AmsterdamMarathonOfficialCourse.RACE_ID
                );
    }

    @Test
    void startupSeederAlsoPromotesCheckedCatalogRoutes() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        when(assetRepository.findByRaceId(anyString())).thenReturn(Optional.empty());
        when(bulkSeedService.readCatalog(null)).thenReturn(List.of(
                new RaceCourseMapBulkSeedService.CatalogRace(
                        "london-marathon", "London Marathon", "London Marathon Events",
                        LondonMarathonKnownCourse.OFFICIAL_COURSE_URL,
                        "London", "United Kingdom", "London, United Kingdom", 42.195, 4, "",
                        51.5074, -0.1278, ""
                )
        ));
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        verify(bulkSeedService, times(12)).seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true));
    }

    @Test
    void startupSeederAlsoPromotesLandmarkCatalogRoutes() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        when(assetRepository.findByRaceId(anyString())).thenReturn(Optional.empty());
        when(bulkSeedService.readCatalog(null)).thenReturn(List.of(
                new RaceCourseMapBulkSeedService.CatalogRace(
                        "honolulu-marathon", "Honolulu Marathon", "Honolulu Marathon Association",
                        "https://www.honolulumarathon.org/our-events/jal-honolulu-marathon",
                        "Honolulu", "United States", "Honolulu, United States", 42.195, 12, "",
                        21.2944, -157.8465, ""
                )
        ));
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService, times(12)).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getAllValues())
                .extracting(RaceCourseMapBulkSeedService.CatalogRace::id)
                .contains("honolulu-marathon");
    }

    @Test
    void startupSeederRefreshesStaleAmsterdamKnownCourseSeed() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleAmsterdam = new RaceCourseMapAsset();
        staleAmsterdam.setRaceId(AmsterdamMarathonOfficialCourse.RACE_ID);
        staleAmsterdam.setOfficialWebsite(AmsterdamMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        staleAmsterdam.setLiveSource("known-official-course:amsterdam-marathon");
        staleAmsterdam.setLiveRoutePointsJson("[{\"lat\":52.36,\"lng\":4.82,\"label\":\"Start\"},"
                + "{\"lat\":52.36,\"lng\":4.98},{\"lat\":52.29,\"lng\":4.98},"
                + "{\"lat\":52.29,\"lng\":4.82},{\"lat\":52.36,\"lng\":4.82,\"label\":\"Finish\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (AmsterdamMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleAmsterdam);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(AmsterdamMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederPreservesVerifiedAdminUploadedOfficialCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset existing = new RaceCourseMapAsset();
        existing.setLiveSource("admin-document-url");
        existing.setLiveImageUrl("local-course-map:new-york-city-marathon-official.png");
        existing.setLiveRoutePointsJson("[{\"lat\":40.0,\"lng\":-73.0},{\"lat\":40.1,\"lng\":-73.1}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (BostonMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentBostonOfficialAsset());
            }
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentTokyoOfficialAsset());
            }
            if (WuxiMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentWuxiOfficialAsset());
            }
            return Optional.of(existing);
        });

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        verify(bulkSeedService, never())
                .seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), anyString(), eq(true));
    }

    @Test
    void startupSeederRefreshesStaleTokyoAdminUploadThatFrontendTrustGateRejects() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleTokyo = new RaceCourseMapAsset();
        staleTokyo.setRaceId(TokyoMarathonOfficialCourse.RACE_ID);
        staleTokyo.setOfficialWebsite("https://www.marathon.tokyo/en/");
        staleTokyo.setLiveSource("admin-image-url");
        staleTokyo.setLiveImageUrl("local-course-map:tokyo-marathon-57cf7732d4f66a66.png");
        staleTokyo.setLiveSummary("Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview.");
        staleTokyo.setLiveRoutePointsJson("[{\"lat\":35.694045768105916,\"lng\":139.76935035557287,\"label\":\"Start\"},"
                + "{\"lat\":35.694045768105916,\"lng\":139.76935035557287,\"label\":\"Finish\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleTokyo);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(TokyoMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederSkipsCurrentOfficialTokyoCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentTokyoOfficialAsset());
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        verify(bulkSeedService, never())
                .seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), anyString(), eq(true));
    }

    @Test
    void startupSeederRefreshesOldWadakuraTokyoOfficialCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset oldWadakuraTokyo = currentTokyoOfficialAsset();
        oldWadakuraTokyo.setLiveSummary("Hermes rendered this course from the official Tokyo Marathon 2026 passing-time landmarks to Wadakura Gate.");
        oldWadakuraTokyo.setLiveRoutePointsJson("[{\"lat\":35.6903,\"lng\":139.6915,\"label\":\"Start - Tokyo Metropolitan Government Bldg. No.1\"},"
                + "{\"lat\":35.7080,\"lng\":139.7730,\"label\":\"Uenohirokoji turning point\"},"
                + "{\"lat\":35.6716,\"lng\":139.7998,\"label\":\"Tomioka Hachimangu turning point\"},"
                + "{\"lat\":35.6720,\"lng\":139.7647,\"label\":\"Ginza\"},"
                + "{\"lat\":35.6457,\"lng\":139.7475,\"label\":\"Tamachi Station turning point\"},"
                + "{\"lat\":35.6824,\"lng\":139.7622,\"label\":\"Finish - Wadakura Gate\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(oldWadakuraTokyo);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(TokyoMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederRefreshesStaleOfficialNewYorkCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleNewYork = new RaceCourseMapAsset();
        staleNewYork.setRaceId(NycMarathonOfficialCourse.RACE_ID);
        staleNewYork.setOfficialWebsite("https://www.nyrr.org/tcsnycmarathon");
        staleNewYork.setLiveSource(NycMarathonOfficialCourse.OFFICIAL_SOURCE);
        staleNewYork.setLiveSummary("Hermes aligned this route from AI terrain sampling.");
        staleNewYork.setLiveTotalClimbMeters(305);
        staleNewYork.setLiveRoutePointsJson("[{\"lat\":40.7,\"lng\":-73.9,\"label\":\"Central Park\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleNewYork);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(NycMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederSkipsCurrentOfficialNewYorkCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset currentNewYork = new RaceCourseMapAsset();
        currentNewYork.setRaceId(NycMarathonOfficialCourse.RACE_ID);
        currentNewYork.setOfficialWebsite(NycMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        currentNewYork.setLiveSource(NycMarathonOfficialCourse.OFFICIAL_SOURCE);
        currentNewYork.setLiveSummary("Route follows the official NYRR elevation profile.");
        currentNewYork.setLiveTotalClimbMeters(NycMarathonOfficialCourse.OFFICIAL_TOTAL_CLIMB_METERS);
        currentNewYork.setLiveElevationSamplesJson("[29,36,48,61,73,79,75,61,46,32,21,15,13,12,14,17]");
        currentNewYork.setLiveRoutePointsJson(currentDetailedNewYorkRouteJson());
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentNewYork);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        verify(bulkSeedService, never())
                .seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), anyString(), eq(true));
    }

    @Test
    void startupSeederRefreshesCurrentTaggedNewYorkCourseMapWithBridgeDetour() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleNewYork = new RaceCourseMapAsset();
        staleNewYork.setRaceId(NycMarathonOfficialCourse.RACE_ID);
        staleNewYork.setOfficialWebsite(NycMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        staleNewYork.setLiveSource(NycMarathonOfficialCourse.OFFICIAL_SOURCE);
        staleNewYork.setLiveSummary("Route follows the official NYRR elevation profile.");
        staleNewYork.setLiveTotalClimbMeters(NycMarathonOfficialCourse.OFFICIAL_TOTAL_CLIMB_METERS);
        staleNewYork.setLiveElevationSamplesJson("[29,36,48,61,73,79,75,61,46,32,21,15,13,12,14,17]");
        staleNewYork.setLiveRoutePointsJson(
                "[{\"lat\":40.6055,\"lng\":-74.0563,\"label\":\"Start - Fort Wadsworth\"},"
                        + "{\"lat\":40.62992,\"lng\":-74.07663,\"label\":\"Stale Staten Island routing detour\"},"
                        + "{\"lat\":40.6076,\"lng\":-74.0412,\"label\":\"Verrazzano-Narrows Bridge\"},"
                        + "{\"lat\":40.7644,\"lng\":-73.9738,\"label\":\"Central Park South\"},"
                        + "{\"lat\":40.7681,\"lng\":-73.9819,\"label\":\"Columbus Circle\"},"
                        + "{\"lat\":40.7724,\"lng\":-73.9789,\"label\":\"Finish - West Drive at Tavern on the Green\"}]"
        );
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleNewYork);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(NycMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederRefreshesCurrentTaggedNewYorkCourseMapWithSparseShortRoute() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleNewYork = new RaceCourseMapAsset();
        staleNewYork.setRaceId(NycMarathonOfficialCourse.RACE_ID);
        staleNewYork.setOfficialWebsite(NycMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        staleNewYork.setLiveSource(NycMarathonOfficialCourse.OFFICIAL_SOURCE);
        staleNewYork.setLiveSummary("Route follows the official NYRR elevation profile.");
        staleNewYork.setLiveTotalClimbMeters(NycMarathonOfficialCourse.OFFICIAL_TOTAL_CLIMB_METERS);
        staleNewYork.setLiveElevationSamplesJson("[29,36,48,61,73,79,75,61,46,32,21,15,13,12,14,17]");
        staleNewYork.setLiveRoutePointsJson(
                "[{\"lat\":40.6055,\"lng\":-74.0563,\"label\":\"Start - Fort Wadsworth\"},"
                        + "{\"lat\":40.6076,\"lng\":-74.0412,\"label\":\"Verrazzano-Narrows Bridge\"},"
                        + "{\"lat\":40.7600,\"lng\":-73.9628,\"label\":\"Queensboro Bridge\"},"
                        + "{\"lat\":40.8118,\"lng\":-73.9293,\"label\":\"Bronx - Willis Ave Bridge\"},"
                        + "{\"lat\":40.8120,\"lng\":-73.9380,\"label\":\"Madison Ave Bridge\"},"
                        + "{\"lat\":40.7655,\"lng\":-73.9729,\"label\":\"Central Park South\"},"
                        + "{\"lat\":40.7681,\"lng\":-73.9819,\"label\":\"Columbus Circle\"},"
                        + "{\"lat\":40.7740,\"lng\":-73.9766,\"label\":\"Finish - West Drive at Tavern on the Green\"}]"
        );
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleNewYork);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(NycMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederRefreshesCurrentTaggedNewYorkCourseMapWithDuplicateStartLabel() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleNewYork = new RaceCourseMapAsset();
        staleNewYork.setRaceId(NycMarathonOfficialCourse.RACE_ID);
        staleNewYork.setOfficialWebsite(NycMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        staleNewYork.setLiveSource(NycMarathonOfficialCourse.OFFICIAL_SOURCE);
        staleNewYork.setLiveSummary("Route follows the official NYRR elevation profile.");
        staleNewYork.setLiveTotalClimbMeters(NycMarathonOfficialCourse.OFFICIAL_TOTAL_CLIMB_METERS);
        staleNewYork.setLiveElevationSamplesJson("[29,36,48,61,73,79,75,61,46,32,21,15,13,12,14,17]");
        staleNewYork.setLiveRoutePointsJson(currentDetailedNewYorkRouteJson()
                .replace("{\"lat\":40.602068,\"lng\":-74.058683}",
                        "{\"lat\":40.602068,\"lng\":-74.058683,\"label\":\"Start - Fort Wadsworth\"}"));
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (NycMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleNewYork);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(NycMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederRefreshesStaleBostonAdminUpload() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset staleBoston = new RaceCourseMapAsset();
        staleBoston.setRaceId(BostonMarathonOfficialCourse.RACE_ID);
        staleBoston.setOfficialWebsite("https://www.baa.org/races/boston-marathon");
        staleBoston.setLiveSource("admin-upload");
        staleBoston.setLiveImageUrl("local-course-map:boston-marathon-1a7a57c21c071553.jpg");
        staleBoston.setLiveSummary("A detailed course map for the Boston Marathon showing the route from Hopkinton to Boston.");
        staleBoston.setLiveRoutePointsJson("[{\"lat\":42.2400,\"lng\":-71.5000,\"label\":\"Start\"},"
                + "{\"lat\":42.3601,\"lng\":-71.0589,\"label\":\"Finish\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (BostonMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(staleBoston);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });
        when(bulkSeedService.seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), eq("startup-seeder"), eq(true)))
                .thenReturn(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        ArgumentCaptor<RaceCourseMapBulkSeedService.CatalogRace> raceCaptor =
                ArgumentCaptor.forClass(RaceCourseMapBulkSeedService.CatalogRace.class);
        verify(bulkSeedService).seedRace(raceCaptor.capture(), eq("startup-seeder"), eq(true));
        assertThat(raceCaptor.getValue().id()).isEqualTo(BostonMarathonOfficialCourse.RACE_ID);
    }

    @Test
    void startupSeederSkipsCurrentOfficialBostonCourseMap() throws Exception {
        RaceCourseMapBulkSeedService bulkSeedService = mock(RaceCourseMapBulkSeedService.class);
        RaceCourseMapAssetRepository assetRepository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset currentBoston = new RaceCourseMapAsset();
        currentBoston.setRaceId(BostonMarathonOfficialCourse.RACE_ID);
        currentBoston.setOfficialWebsite(BostonMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        currentBoston.setLiveSource(BostonMarathonOfficialCourse.OFFICIAL_SOURCE);
        currentBoston.setLiveImageUrl(null);
        currentBoston.setLiveSummary("Hermes rendered this course from the official B.A.A. Boston Marathon route to Boylston Street.");
        currentBoston.setLiveRoutePointsJson("[{\"lat\":42.2294,\"lng\":-71.5176,\"label\":\"Start - Hopkinton\"},"
                + "{\"lat\":42.3367,\"lng\":-71.1700,\"label\":\"Heartbreak Hill\"},"
                + "{\"lat\":42.3478,\"lng\":-71.0850,\"label\":\"Hereford Street\"},"
                + "{\"lat\":42.3496,\"lng\":-71.0786,\"label\":\"Finish - Boylston Street\"}]");
        when(assetRepository.findByRaceId(anyString())).thenAnswer(invocation -> {
            String raceId = invocation.getArgument(0, String.class);
            if (BostonMarathonOfficialCourse.RACE_ID.equals(raceId)) {
                return Optional.of(currentBoston);
            }
            return Optional.of(verifiedAdminAsset(raceId));
        });

        ApplicationRunner runner = new OfficialCourseStartupSeedConfiguration()
                .officialCourseStartupSeeder(bulkSeedService, assetRepository);

        runner.run(null);

        verify(bulkSeedService, never())
                .seedRace(any(RaceCourseMapBulkSeedService.CatalogRace.class), anyString(), eq(true));
    }

    private RaceCourseMapAsset verifiedAdminAsset(String raceId) {
        if (BostonMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return currentBostonOfficialAsset();
        }
        if (TokyoMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return currentTokyoOfficialAsset();
        }
        if (WuxiMarathonOfficialCourse.RACE_ID.equals(raceId)) {
            return currentWuxiOfficialAsset();
        }
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId(raceId);
        asset.setLiveSource("admin-document-url");
        asset.setLiveImageUrl("local-course-map:" + raceId + "-official.png");
        asset.setLiveRoutePointsJson("[{\"lat\":40.0,\"lng\":-73.0},{\"lat\":40.1,\"lng\":-73.1}]");
        return asset;
    }

    private RaceCourseMapAsset currentBostonOfficialAsset() {
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId(BostonMarathonOfficialCourse.RACE_ID);
        asset.setOfficialWebsite(BostonMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        asset.setLiveSource(BostonMarathonOfficialCourse.OFFICIAL_SOURCE);
        asset.setLiveImageUrl(null);
        asset.setLiveSummary("Hermes rendered this course from the official B.A.A. Boston Marathon route to Boylston Street.");
        asset.setLiveRoutePointsJson("[{\"lat\":42.2294,\"lng\":-71.5176,\"label\":\"Start - Hopkinton\"},"
                + "{\"lat\":42.3367,\"lng\":-71.1700,\"label\":\"Heartbreak Hill\"},"
                + "{\"lat\":42.3478,\"lng\":-71.0850,\"label\":\"Hereford Street\"},"
                + "{\"lat\":42.3496,\"lng\":-71.0786,\"label\":\"Finish - Boylston Street\"}]");
        return asset;
    }

    private RaceCourseMapAsset currentTokyoOfficialAsset() {
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId(TokyoMarathonOfficialCourse.RACE_ID);
        asset.setOfficialWebsite(TokyoMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        asset.setLiveSource(TokyoMarathonOfficialCourse.OFFICIAL_SOURCE);
        asset.setLiveImageUrl(null);
        asset.setLiveSummary("Hermes rendered this course from the official Tokyo Marathon 2026 passing-time landmarks and official course-map finish at Tokyo Station / Gyoko-dori Ave.");
        asset.setLiveRoutePointsJson("[{\"lat\":35.6903,\"lng\":139.6915,\"label\":\"Start - Tokyo Metropolitan Government Bldg. No.1\"},"
                + "{\"lat\":35.7080,\"lng\":139.7730,\"label\":\"Uenohirokoji turning point\"},"
                + "{\"lat\":35.6716,\"lng\":139.7998,\"label\":\"Tomioka Hachimangu turning point\"},"
                + "{\"lat\":35.6720,\"lng\":139.7647,\"label\":\"Ginza\"},"
                + "{\"lat\":35.6457,\"lng\":139.7475,\"label\":\"Tamachi Station turning point\"},"
                + "{\"lat\":35.6815,\"lng\":139.7649,\"label\":\"Finish - Tokyo Station / Gyoko-dori Ave.\"}]");
        return asset;
    }

    private RaceCourseMapAsset currentWuxiOfficialAsset() {
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId(WuxiMarathonOfficialCourse.RACE_ID);
        asset.setOfficialWebsite(WuxiMarathonOfficialCourse.OFFICIAL_COURSE_URL);
        asset.setLiveSource(WuxiMarathonOfficialCourse.OFFICIAL_SOURCE);
        asset.setLiveImageUrl(null);
        asset.setLiveSummary("Hermes rendered this course from the official 2026 Wuxi Marathon route through Gonghu Bay and the Expo Center finish.");
        asset.setLiveRoutePointsJson("[{\"lat\":31.5530,\"lng\":120.2530,\"label\":\"Start - Taihu Avenue / Yinxiu Road\"},"
                + "{\"lat\":31.49296,\"lng\":120.22605,\"label\":\"Jiangnan University South Gate\"},"
                + "{\"lat\":31.48387,\"lng\":120.31938,\"label\":\"Finance Second Street / Fangmiao Road\"},"
                + "{\"lat\":31.47836,\"lng\":120.32303,\"label\":\"Finish - Wuxi Taihu International Expo Center\"}]");
        return asset;
    }

    private String currentDetailedNewYorkRouteJson() {
        List<double[]> route = NycMarathonOfficialCourse.detailedRoute();
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < route.size(); i++) {
            if (i > 0) {
                json.append(',');
            }
            double[] point = route.get(i);
            json.append("{\"lat\":").append(point[0])
                    .append(",\"lng\":").append(point[1]);
            String label = newYorkLabelForDetailedRouteIndex(i, route.size());
            if (label != null) {
                json.append(",\"label\":\"").append(label).append("\"");
            }
            json.append('}');
        }
        json.append(']');
        return json.toString();
    }

    private String newYorkLabelForDetailedRouteIndex(int index, int routeSize) {
        return switch (index) {
            case 0 -> "Start - Fort Wadsworth";
            case 20 -> "Verrazzano-Narrows Bridge";
            case 220 -> "Queensboro Bridge";
            case 282 -> "Bronx - Willis Ave Bridge";
            case 299 -> "Madison Ave Bridge";
            case 424 -> "Central Park South";
            case 432 -> "Columbus Circle";
            default -> index == routeSize - 1 ? "Finish - West Drive at Tavern on the Green" : null;
        };
    }
}
