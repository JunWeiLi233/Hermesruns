package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

/**
 * One-shot CLI runner that bulk-seeds synthetic geographic-loop course maps
 * for every catalog race, so each {@code /races/details/<raceId>} page has a
 * working map + elevation chart even without the admin portal upload flow.
 *
 * <p>Activate by starting the backend with
 * {@code -Dapp.course-map.bulk-seed.enabled=true}. By default the runner
 * exits the JVM once the seed completes, mirroring
 * {@link CourseMapBulkScanCommand}, so it can be used as a one-shot
 * {@code mvnw spring-boot:run} invocation in CI or developer environments.
 */
@Component
@ConditionalOnProperty(name = "app.course-map.bulk-seed.enabled", havingValue = "true")
@Order(Ordered.LOWEST_PRECEDENCE)
public class RaceCourseMapBulkSeedCommand implements CommandLineRunner {
    private static final Logger logger = LoggerFactory.getLogger(RaceCourseMapBulkSeedCommand.class);

    private final RaceCourseMapBulkSeedService bulkSeedService;
    private final ConfigurableApplicationContext applicationContext;

    @Value("${app.course-map.bulk-seed.catalog-file:}")
    private String catalogFile;

    @Value("${app.course-map.bulk-seed.overwrite-synthetic:false}")
    private boolean overwriteSynthetic;

    @Value("${app.course-map.bulk-seed.actor-email:bulk-seed@hermes.local}")
    private String actorEmail;

    @Value("${app.course-map.bulk-seed.exit-when-complete:true}")
    private boolean exitWhenComplete;

    @Value("${app.course-map.bulk-seed.backfill-elevation:true}")
    private boolean backfillElevation;

    @Value("${app.course-map.bulk-seed.overwrite-existing-elevation:false}")
    private boolean overwriteExistingElevation;

    public RaceCourseMapBulkSeedCommand(RaceCourseMapBulkSeedService bulkSeedService,
                                        ConfigurableApplicationContext applicationContext) {
        this.bulkSeedService = bulkSeedService;
        this.applicationContext = applicationContext;
    }

    @Override
    public void run(String... args) {
        Path catalogPath = catalogFile == null || catalogFile.isBlank() ? null : Path.of(catalogFile);
        int totalFailed = 0;
        try {
            RaceCourseMapBulkSeedService.BulkSeedSummary seedSummary =
                    bulkSeedService.seedAllMissingFromCatalog(catalogPath, actorEmail, overwriteSynthetic);
            logger.info("bulk-seed-summary catalogSize={} seeded={} skipped={} failed={} overwriteSynthetic={}",
                    seedSummary.catalogSize(), seedSummary.seeded(), seedSummary.skipped(), seedSummary.failed(), overwriteSynthetic);
            totalFailed += seedSummary.failed();

            if (backfillElevation) {
                RaceCourseMapBulkSeedService.ElevationBackfillSummary elevationSummary =
                        bulkSeedService.backfillMissingElevation(overwriteExistingElevation);
                logger.info("elevation-backfill-summary total={} healed={} skipped={} failed={} overwrite={}",
                        elevationSummary.totalAssets(), elevationSummary.healed(),
                        elevationSummary.skipped(), elevationSummary.failed(), overwriteExistingElevation);
                totalFailed += elevationSummary.failed();
            }

            if (exitWhenComplete) {
                int exit = totalFailed > 0 ? 1 : 0;
                SpringApplication.exit(applicationContext, () -> exit);
            }
        } catch (RuntimeException ex) {
            logger.error("bulk-seed failed", ex);
            if (exitWhenComplete) {
                SpringApplication.exit(applicationContext, () -> 2);
            }
            throw ex;
        }
    }
}
