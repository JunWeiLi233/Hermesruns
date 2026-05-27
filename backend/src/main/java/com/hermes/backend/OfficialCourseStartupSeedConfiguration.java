package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import java.util.List;

/**
 * Ensures every race with hardcoded official waypoints (NYC and Tokyo) has a
 * seeded, street-following polyline in the database on every backend startup.
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

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    ApplicationRunner officialCourseStartupSeeder(
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
                                    TokyoMarathonOfficialCourse.RACE_ID,
                                    "Tokyo Marathon",
                                    "Tokyo Marathon Foundation",
                                    TokyoMarathonOfficialCourse.OFFICIAL_COURSE_URL,
                                    "Tokyo", "Japan", "Tokyo, Japan",
                                    42.195, 3, "", 35.685, 139.76, null
                            ),
                            TokyoMarathonOfficialCourse.OFFICIAL_SOURCE
                    )
            );

            for (OfficialRaceEntry entry : officialRaces) {
                String raceId = entry.race().id();
                boolean alreadySeeded = assetRepository.findByRaceId(raceId)
                        .map(asset -> entry.officialSource().equals(asset.getLiveSource()))
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
        };
    }

    private record OfficialRaceEntry(
            RaceCourseMapBulkSeedService.CatalogRace race,
            String officialSource
    ) {}
}
