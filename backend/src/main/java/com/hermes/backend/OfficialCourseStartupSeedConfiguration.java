package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ensures every race with hardcoded official waypoints or checked ordered
 * route geometry has a seeded polyline in the database on every backend
 * startup.
 *
 * <p>A quick DB read per race skips re-seeding when the official source tag is
 * already stored, so subsequent starts pay only one SELECT per race. The first
 * start after adding a new official course (or after the DB is wiped) triggers
 * the OSRM-routing pass automatically — no admin portal click required.
 */
@Configuration
public class OfficialCourseStartupSeedConfiguration {

    private static final Logger logger =
            LoggerFactory.getLogger(OfficialCourseStartupSeedConfiguration.class);
    private static final Pattern JSON_LNG_PATTERN =
            Pattern.compile("\"lng\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)");
    private static final Pattern JSON_ROUTE_POINT_PATTERN =
            Pattern.compile("\"lat\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*\"lng\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)");
    private static final double NYC_WESTWARD_DETOUR_LNG = -74.0600;

    /**
     * Single daemon thread so the per-race DB checks (and any OSRM routing pass
     * a stale course triggers) run off the boot critical path — the app serves
     * traffic while seeding continues in the background.
     */
    private static final java.util.concurrent.ExecutorService SEED_EXECUTOR =
            java.util.concurrent.Executors.newSingleThreadExecutor(runnable -> {
                Thread thread = new Thread(runnable, "official-course-startup-seeder");
                thread.setDaemon(true);
                return thread;
            });

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    @ConditionalOnProperty(name = "app.official-course.startup-seed.enabled", havingValue = "true", matchIfMissing = true)
    ApplicationRunner officialCourseStartupSeeder(
            RaceCourseMapBulkSeedService bulkSeedService,
            RaceCourseMapAssetRepository assetRepository
    ) {
        ApplicationRunner delegate = officialCourseStartupSeedRunner(bulkSeedService, assetRepository);
        return args -> SEED_EXECUTOR.execute(() -> {
            try {
                delegate.run(args);
            } catch (Exception e) {
                logger.warn("official-course-startup-seed background pass failed: {}", e.getMessage(), e);
            }
        });
    }

    ApplicationRunner officialCourseStartupSeedRunner(
            RaceCourseMapBulkSeedService bulkSeedService,
            RaceCourseMapAssetRepository assetRepository
    ) {
        return args -> {
            List<OfficialRaceEntry> officialRaces = List.of(
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    NycMarathonOfficialCourse.RACE_ID,
                                    "New York City Marathon",
                                    "NYRR",
                                    NycMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "New York City", "United States", "New York City, United States",
                                    42.195, 11, "NYRR 9+1", 40.7128, -74.006, null
                            ),
                            NycMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    BostonMarathonOfficialCourse.RACE_ID,
                                    "Boston Marathon",
                                    "B.A.A.",
                                    BostonMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Boston", "United States", "Boston, United States",
                                    42.195, 4, "", 42.3601, -71.0589, null
                            ),
                            BostonMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    ChicagoMarathonKnownCourse.RACE_ID,
                                    "Chicago Marathon",
                                    "Bank of America",
                                    ChicagoMarathonKnownCourse.OFFICIAL_COURSE_URL,
                                    "Chicago", "United States", "Chicago, United States",
                                    42.195, 10, "", 41.8781, -87.6298, null
                            ),
                            ChicagoMarathonKnownCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    TokyoMarathonOfficialCourse.RACE_ID,
                                    "Tokyo Marathon",
                                    "Tokyo Marathon Foundation",
                                    TokyoMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Tokyo", "Japan", "Tokyo, Japan",
                                    42.195, 3, "", 35.685, 139.76, null
                            ),
                            TokyoMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    LosAngelesMarathonOfficialCourse.RACE_ID,
                                    "Los Angeles Marathon",
                                    "The McCourt Foundation",
                                    LosAngelesMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Los Angeles", "United States", "Los Angeles, United States",
                                    42.195, 3, "", 34.0522, -118.2437, null
                            ),
                            LosAngelesMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    OsakaMarathonOfficialCourse.RACE_ID,
                                    "Osaka Marathon",
                                    "Osaka Marathon Organizing Committee",
                                    OsakaMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Osaka", "Japan", "Osaka, Japan",
                                    42.195, 2, "", 34.6937, 135.5023, null
                            ),
                            OsakaMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    AthensMarathonOfficialCourse.RACE_ID,
                                    "Athens Marathon",
                                    "Athens Marathon The Authentic",
                                    AthensMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Athens", "Greece", "Athens, Greece",
                                    42.195, 11, "", 37.9838, 23.7275, null
                            ),
                            AthensMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    WuxiMarathonOfficialCourse.RACE_ID,
                                    "Wuxi Marathon",
                                    "Wuxi Marathon",
                                    WuxiMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Wuxi", "China", "Wuxi, China",
                                    42.195, 3, "", 31.4912, 120.3119, null
                            ),
                            WuxiMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    BerlinMarathonOfficialCourse.RACE_ID,
                                    "Berlin Marathon",
                                    "SCC EVENTS",
                                    BerlinMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Berlin", "Germany", "Berlin, Germany",
                                    42.195, 9, "", 52.5200, 13.4050, null
                            ),
                            BerlinMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    BergenCityMarathonOfficialCourse.RACE_ID,
                                    "Bergen City Marathon",
                                    "Bergen City Marathon",
                                    BergenCityMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Bergen", "Norway", "Bergen, Norway",
                                    42.195, 4, "", 60.3913, 5.3221, null
                            ),
                            BergenCityMarathonOfficialCourse.OFFICIAL_SOURCE
                    ),
                    new OfficialRaceEntry(
                            new RaceCourseMapBulkSeedService.CatalogRace(
                                    AmsterdamMarathonOfficialCourse.RACE_ID,
                                    "Amsterdam Marathon",
                                    "Le Champion",
                                    AmsterdamMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Amsterdam", "Netherlands", "Amsterdam, Netherlands",
                                    42.195, 10, "", 52.3676, 4.9041, null
                            ),
                            AmsterdamMarathonOfficialCourse.OFFICIAL_SOURCE
                    )
            );

            for (OfficialRaceEntry entry : officialRaces) {
                String raceId = entry.race().id();
                boolean alreadySeeded = assetRepository.findByRaceId(raceId)
                        .map(asset -> hasCurrentOfficialCourseSeed(asset, entry)
                                || (allowsVerifiedAdminCourseMapPreservation(entry)
                                && hasVerifiedAdminCourseMap(asset)))
                        .orElse(false);
                if (alreadySeeded) {
                    logger.debug("official-course-startup-seed: {} already official — skipping", raceId);
                    continue;
                }
                logger.info("official-course-startup-seed: seeding {} with official waypoints", raceId);
                RaceCourseMapBulkSeedService.SeedOutcome outcome =
                        bulkSeedService.seedRace(entry.race(), "startup-seeder", true);
                logger.info("official-course-startup-seed: {} → {}", raceId, outcome);
            }

            // Promote the rest of the checked ordered-route catalog too. This
            // repairs an existing synthetic row on restart instead of waiting
            // for a manual bulk-seed command.
            Set<String> bespokeIds = officialRaces.stream()
                    .map(entry -> entry.race().id())
                    .collect(java.util.stream.Collectors.toUnmodifiableSet());
            List<RaceCourseMapBulkSeedService.CatalogRace> catalog;
            try {
                catalog = bulkSeedService.readCatalog(null);
            } catch (RuntimeException ex) {
                logger.warn("official-course-startup-seed: checked catalog unavailable: {}", ex.getMessage());
                catalog = List.of();
            }
            for (RaceCourseMapBulkSeedService.CatalogRace race : catalog) {
                boolean checkedCatalogRoute = race != null
                        && (RaceKnownOrderedCourseCatalog.knownOrderedCourseFor(race.name(), race.city(), race.country()) != null
                        || MarathonOfficialLandmarkCourseCatalog.has(race.id()));
                if (race == null || bespokeIds.contains(race.id()) || !checkedCatalogRoute) {
                    continue;
                }
                boolean alreadySeeded = assetRepository.findByRaceId(race.id())
                        .map(asset -> hasCurrentKnownCourseSeed(asset, race.id()) || hasVerifiedAdminCourseMap(asset))
                        .orElse(false);
                if (alreadySeeded) continue;
                logger.info("official-course-startup-seed: promoting checked catalog route {}", race.id());
                bulkSeedService.seedRace(race, "startup-seeder", true);
            }
        };
    }

    private boolean hasCurrentKnownCourseSeed(RaceCourseMapAsset asset, String raceId) {
        if (asset == null || raceId == null || raceId.isBlank()) return false;
        String source = asset.getLiveSource() == null ? "" : asset.getLiveSource().trim();
        String routePoints = asset.getLiveRoutePointsJson() == null ? "" : asset.getLiveRoutePointsJson().trim();
        return source.equals("known-official-course:" + raceId) && routePoints.length() > 100;
    }

    private boolean hasCurrentOfficialCourseSeed(RaceCourseMapAsset asset, OfficialRaceEntry entry) {
        if (asset == null || entry == null || entry.race() == null) {
            return false;
        }
        if (!entry.officialSource().equals(asset.getLiveSource())) {
            return false;
        }
        if (!sameTrimmed(entry.race().officialWebsite(), asset.getOfficialWebsite())) {
            return false;
        }
        if (NycMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentNewYorkOfficialSeed(asset);
        }
        if (BostonMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentBostonOfficialSeed(asset);
        }
        if (ChicagoMarathonKnownCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentChicagoOfficialSeed(asset);
        }
        if (TokyoMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentTokyoOfficialSeed(asset);
        }
        if (WuxiMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentWuxiOfficialSeed(asset);
        }
        if (BerlinMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentBerlinOfficialSeed(asset);
        }
        if (BergenCityMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentBergenOfficialSeed(asset);
        }
        if (AmsterdamMarathonOfficialCourse.RACE_ID.equals(entry.race().id())) {
            return hasCurrentAmsterdamOfficialSeed(asset);
        }
        return true;
    }

    private boolean hasCurrentBerlinOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - tiergarten")
                && routePoints.contains("finish - brandenburg gate")
                && routePointCount(asset.getLiveRoutePointsJson()) >= 500;
    }

    private boolean hasCurrentAmsterdamOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - olympic stadium")
                && routePoints.contains("ouderkerk turnaround")
                && routePoints.contains("science park east return")
                && routePoints.contains("finish - olympic stadium")
                && routePointCount(asset.getLiveRoutePointsJson()) >= 500;
    }

    private boolean hasCurrentBergenOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - bryggen")
                && routePoints.contains("halfway - second official lap")
                && routePoints.contains("finish - bryggen")
                && routePointCount(asset.getLiveRoutePointsJson()) >= 2200;
    }

    private int routePointCount(String routePointsJson) {
        if (routePointsJson == null || routePointsJson.isBlank()) {
            return 0;
        }
        Matcher matcher = JSON_ROUTE_POINT_PATTERN.matcher(routePointsJson);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private boolean hasCurrentNewYorkOfficialSeed(RaceCourseMapAsset asset) {
        if (!Integer.valueOf(NycMarathonOfficialCourse.OFFICIAL_TOTAL_CLIMB_METERS)
                .equals(asset.getLiveTotalClimbMeters())) {
            return false;
        }
        String summary = lower(asset.getLiveSummary());
        if (!summary.contains("official nyrr elevation profile")) {
            return false;
        }
        String elevationSamples = asset.getLiveElevationSamplesJson() == null
                ? ""
                : asset.getLiveElevationSamplesJson().trim();
        if (elevationSamples.length() < 20 || "[]".equals(elevationSamples)) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return hasSingleOccurrence(routePoints, "start - fort wadsworth")
                && routePoints.contains("verrazzano-narrows bridge")
                && routePoints.contains("central park south")
                && routePoints.contains("columbus circle")
                && hasSingleOccurrence(routePoints, "finish - west drive at tavern on the green")
                && hasNoNewYorkWestwardBridgeDetour(asset.getLiveRoutePointsJson())
                && hasCurrentNewYorkDetailedRouteDistance(asset.getLiveRoutePointsJson());
    }

    private boolean hasSingleOccurrence(String value, String needle) {
        if (value == null || value.isBlank() || needle == null || needle.isBlank()) {
            return false;
        }
        int first = value.indexOf(needle);
        return first >= 0 && value.indexOf(needle, first + needle.length()) < 0;
    }

    private boolean hasNoNewYorkWestwardBridgeDetour(String routePointsJson) {
        Matcher matcher = JSON_LNG_PATTERN.matcher(normalize(routePointsJson));
        boolean foundLongitude = false;
        while (matcher.find()) {
            foundLongitude = true;
            try {
                if (Double.parseDouble(matcher.group(1)) < NYC_WESTWARD_DETOUR_LNG) {
                    return false;
                }
            } catch (NumberFormatException ex) {
                return false;
            }
        }
        return foundLongitude;
    }

    private boolean hasCurrentNewYorkDetailedRouteDistance(String routePointsJson) {
        Matcher matcher = JSON_ROUTE_POINT_PATTERN.matcher(normalize(routePointsJson));
        double previousLat = 0.0;
        double previousLng = 0.0;
        double distanceKm = 0.0;
        int count = 0;
        while (matcher.find()) {
            double lat;
            double lng;
            try {
                lat = Double.parseDouble(matcher.group(1));
                lng = Double.parseDouble(matcher.group(2));
            } catch (NumberFormatException ex) {
                return false;
            }
            if (count > 0) {
                distanceKm += haversineKm(previousLat, previousLng, lat, lng);
            }
            previousLat = lat;
            previousLng = lng;
            count++;
        }
        return count >= 400 && distanceKm >= 42.0 && distanceKm <= 43.2;
    }

    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double radiusKm = 6371.0088;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(rLat1) * Math.cos(rLat2)
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * radiusKm * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    private boolean hasCurrentChicagoOfficialSeed(RaceCourseMapAsset asset) {
        if (!Integer.valueOf(ChicagoMarathonKnownCourse.OFFICIAL_TOTAL_CLIMB_METERS)
                .equals(asset.getLiveTotalClimbMeters())) {
            return false;
        }
        String summary = lower(asset.getLiveSummary());
        if (!summary.contains("official chicago marathon course map")
                || !summary.contains("flat city profile")) {
            return false;
        }
        String elevationSamples = asset.getLiveElevationSamplesJson() == null
                ? ""
                : asset.getLiveElevationSamplesJson().trim();
        if (elevationSamples.length() < 20 || "[]".equals(elevationSamples) || elevationSamples.contains("289")) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - grant park")
                && routePoints.contains("finish - grant park");
    }

    private boolean hasCurrentBostonOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String summary = lower(asset.getLiveSummary());
        if (!summary.contains("official b.a.a. boston marathon route")
                || !summary.contains("boylston")) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - hopkinton")
                && routePoints.contains("heartbreak hill")
                && routePoints.contains("hereford street")
                && routePoints.contains("finish - boylston street")
                && !routePoints.contains("\"label\":\"finish\",\"lat\":42.3601")
                && !routePoints.contains("\"lat\":42.3601,\"lng\":-71.0589,\"label\":\"finish\"");
    }

    private boolean hasCurrentTokyoOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String summary = lower(asset.getLiveSummary());
        if (!summary.contains("official tokyo marathon")
                || !summary.contains("gyoko-dori")) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - tokyo metropolitan government bldg. no.1")
                && routePoints.contains("uenohirokoji")
                && routePoints.contains("tomioka hachimangu")
                && routePoints.contains("tamachi station")
                && routePoints.contains("finish - tokyo station / gyoko-dori ave.")
                && !routePoints.contains("finish - wadakura gate")
                && !routePoints.contains("tatsumi")
                && !routePoints.contains("tsukishima");
    }

    private boolean hasCurrentWuxiOfficialSeed(RaceCourseMapAsset asset) {
        if (asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return false;
        }
        String summary = lower(asset.getLiveSummary());
        if (!summary.contains("official 2026 wuxi marathon")
                || !summary.contains("gonghu bay")
                || !summary.contains("expo center")) {
            return false;
        }
        String routePoints = lower(asset.getLiveRoutePointsJson());
        return routePoints.contains("start - taihu avenue / yinxiu road")
                && routePoints.contains("jiangnan university south gate")
                && routePoints.contains("finance second street")
                && routePoints.contains("finish - wuxi taihu international expo center");
    }

    private boolean sameTrimmed(String expected, String actual) {
        return normalize(expected).equals(normalize(actual));
    }

    private String lower(String value) {
        return normalize(value).toLowerCase(java.util.Locale.ROOT);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean allowsVerifiedAdminCourseMapPreservation(OfficialRaceEntry entry) {
        return entry != null
                && entry.race() != null
                && !BostonMarathonOfficialCourse.RACE_ID.equals(entry.race().id())
                && !TokyoMarathonOfficialCourse.RACE_ID.equals(entry.race().id())
                && !WuxiMarathonOfficialCourse.RACE_ID.equals(entry.race().id());
    }

    private boolean hasVerifiedAdminCourseMap(RaceCourseMapAsset asset) {
        if (asset == null) {
            return false;
        }
        String source = asset.getLiveSource() == null ? "" : asset.getLiveSource().trim();
        String imageUrl = asset.getLiveImageUrl() == null ? "" : asset.getLiveImageUrl().trim();
        String routePoints = asset.getLiveRoutePointsJson() == null ? "" : asset.getLiveRoutePointsJson().trim();
        return source.startsWith("admin-") && !imageUrl.isBlank() && routePoints.length() > 2;
    }

    private record OfficialRaceEntry(
            RaceCourseMapBulkSeedService.CatalogRace race,
            String officialSource
    ) {}
}
