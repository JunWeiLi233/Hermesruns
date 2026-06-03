package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LocalSharedRunnerBootstrapConfiguration {
    private static final Logger log = LoggerFactory.getLogger(LocalSharedRunnerBootstrapConfiguration.class);

    @Value("${hermes.environment:development}")
    private String hermesEnvironment;

    @Value("${app.local-shared-runner.enabled:false}")
    private boolean enabled;

    @Value("${app.local-shared-runner.email:strava+140971747@hermes.local}")
    private String email;

    @Value("${app.local-shared-runner.password:}")
    private String password;

    @Value("${app.local-shared-runner.strava-athlete-id:140971747}")
    private Long stravaAthleteId;

    @Value("${app.local-shared-runner.display-name:Hermes Shared Runner}")
    private String displayName;

    @Value("${app.local-shared-runner.seed-mock-data:true}")
    private boolean seedMockData;

    @Value("${app.local-territory-rival.enabled:true}")
    private boolean territoryRivalEnabled;

    @Value("${app.local-territory-rival.email:territory-rival@hermes.local}")
    private String territoryRivalEmail;

    @Value("${app.local-territory-rival.password:}")
    private String territoryRivalPassword;

    @Value("${app.local-territory-rival.strava-athlete-id:140971748}")
    private Long territoryRivalStravaAthleteId;

    @Value("${app.local-territory-rival.display-name:Hermes Temporal Rival}")
    private String territoryRivalDisplayName;

    @Value("${app.local-territory-rival.seed-mock-data:true}")
    private boolean territoryRivalSeedMockData;

    @Value("${app.local-territory-flushing.enabled:true}")
    private boolean territoryFlushingEnabled;

    @Value("${app.local-territory-flushing.email:territory-flushing@hermes.local}")
    private String territoryFlushingEmail;

    @Value("${app.local-territory-flushing.password:}")
    private String territoryFlushingPassword;

    @Value("${app.local-territory-flushing.strava-athlete-id:140971749}")
    private Long territoryFlushingStravaAthleteId;

    @Value("${app.local-territory-flushing.display-name:Hermes Flushing Territory Tester}")
    private String territoryFlushingDisplayName;

    @Value("${app.local-territory-flushing.seed-mock-data:true}")
    private boolean territoryFlushingSeedMockData;

    @Value("${app.local-territory-flushing-inner.enabled:true}")
    private boolean territoryFlushingInnerEnabled;

    @Value("${app.local-territory-flushing-inner.email:territory-flushing-inner@hermes.local}")
    private String territoryFlushingInnerEmail;

    @Value("${app.local-territory-flushing-inner.password:}")
    private String territoryFlushingInnerPassword;

    @Value("${app.local-territory-flushing-inner.strava-athlete-id:140971750}")
    private Long territoryFlushingInnerStravaAthleteId;

    @Value("${app.local-territory-flushing-inner.display-name:Hermes Inner Flushing Occupier}")
    private String territoryFlushingInnerDisplayName;

    @Value("${app.local-territory-flushing-inner.seed-mock-data:true}")
    private boolean territoryFlushingInnerSeedMockData;

    @Value("${app.local-territory-berlin.enabled:true}")
    private boolean territoryBerlinEnabled;

    @Value("${app.local-territory-berlin.email:territory-berlin@hermes.local}")
    private String territoryBerlinEmail;

    @Value("${app.local-territory-berlin.password:}")
    private String territoryBerlinPassword;

    @Value("${app.local-territory-berlin.strava-athlete-id:140971751}")
    private Long territoryBerlinStravaAthleteId;

    @Value("${app.local-territory-berlin.display-name:Hermes Berlin Land Conqueror}")
    private String territoryBerlinDisplayName;

    @Value("${app.local-territory-berlin.seed-mock-data:true}")
    private boolean territoryBerlinSeedMockData;

    @Bean
    ApplicationRunner localSharedRunnerBootstrapRunner(LocalSharedRunnerBootstrapService bootstrapService) {
        return args -> {
            if (!enabled) {
                return;
            }

            if ("production".equalsIgnoreCase(hermesEnvironment)) {
                log.warn("[Hermes] Local shared runner bootstrap is disabled in production.");
                return;
            }

            if (password == null || password.isBlank()) {
                log.warn("[Hermes] APP_LOCAL_SHARED_RUNNER_ENABLED is true, but APP_LOCAL_SHARED_RUNNER_PASSWORD is missing.");
                return;
            }

            LocalSharedRunnerBootstrapService.BootstrapResult result = bootstrapService.bootstrap(
                    new LocalSharedRunnerBootstrapService.BootstrapConfig(
                            email,
                            password,
                            stravaAthleteId,
                            displayName,
                            seedMockData
                    )
            );
            log.info(
                    "[Hermes] Local shared runner {} is ready (seeded shoes={}, seeded activities={}).",
                    result.email(),
                    result.seededShoes(),
                    result.seededActivities()
            );

            if (territoryRivalEnabled) {
                if (territoryRivalPassword == null || territoryRivalPassword.isBlank()) {
                    log.warn("[Hermes] Local territory rival bootstrap is enabled, but APP_LOCAL_TERRITORY_RIVAL_PASSWORD is missing.");
                } else {
                    LocalSharedRunnerBootstrapService.BootstrapResult rivalResult = bootstrapService.bootstrap(
                            new LocalSharedRunnerBootstrapService.BootstrapConfig(
                                    territoryRivalEmail,
                                    territoryRivalPassword,
                                    territoryRivalStravaAthleteId,
                                    territoryRivalDisplayName,
                                    territoryRivalSeedMockData,
                                    LocalSharedRunnerBootstrapService.SeedProfile.TERRITORY_RIVAL
                            )
                    );
                    log.info(
                            "[Hermes] Reserved territory rival {} is ready (seeded shoes={}, seeded activities={}).",
                            rivalResult.email(),
                            rivalResult.seededShoes(),
                            rivalResult.seededActivities()
                    );
                }
            }

            if (!territoryFlushingEnabled) {
                return;
            }

            if (territoryFlushingPassword == null || territoryFlushingPassword.isBlank()) {
                log.warn("[Hermes] Local Flushing territory bootstrap is enabled, but APP_LOCAL_TERRITORY_FLUSHING_PASSWORD is missing.");
                return;
            }

            LocalSharedRunnerBootstrapService.BootstrapResult flushingResult = bootstrapService.bootstrap(
                    new LocalSharedRunnerBootstrapService.BootstrapConfig(
                            territoryFlushingEmail,
                            territoryFlushingPassword,
                            territoryFlushingStravaAthleteId,
                            territoryFlushingDisplayName,
                            territoryFlushingSeedMockData,
                            LocalSharedRunnerBootstrapService.SeedProfile.FLUSHING_TERRITORY
                    )
            );
            log.info(
                    "[Hermes] Flushing territory test account {} is ready (seeded shoes={}, seeded activities={}).",
                    flushingResult.email(),
                    flushingResult.seededShoes(),
                    flushingResult.seededActivities()
            );

            if (!territoryFlushingInnerEnabled) {
                return;
            }

            if (territoryFlushingInnerPassword == null || territoryFlushingInnerPassword.isBlank()) {
                log.warn("[Hermes] Local inner-Flushing territory bootstrap is enabled, but APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD is missing.");
                return;
            }

            LocalSharedRunnerBootstrapService.BootstrapResult innerFlushingResult = bootstrapService.bootstrap(
                    new LocalSharedRunnerBootstrapService.BootstrapConfig(
                            territoryFlushingInnerEmail,
                            territoryFlushingInnerPassword,
                            territoryFlushingInnerStravaAthleteId,
                            territoryFlushingInnerDisplayName,
                            territoryFlushingInnerSeedMockData,
                            LocalSharedRunnerBootstrapService.SeedProfile.INNER_FLUSHING_TERRITORY
                    )
            );
            log.info(
                    "[Hermes] Inner-Flushing territory occupier {} is ready (seeded shoes={}, seeded activities={}).",
                    innerFlushingResult.email(),
                    innerFlushingResult.seededShoes(),
                    innerFlushingResult.seededActivities()
            );

            if (!territoryBerlinEnabled) {
                return;
            }

            if (territoryBerlinPassword == null || territoryBerlinPassword.isBlank()) {
                log.warn("[Hermes] Local Berlin territory bootstrap is enabled, but APP_LOCAL_TERRITORY_BERLIN_PASSWORD is missing.");
                return;
            }

            LocalSharedRunnerBootstrapService.BootstrapResult berlinResult = bootstrapService.bootstrap(
                    new LocalSharedRunnerBootstrapService.BootstrapConfig(
                            territoryBerlinEmail,
                            territoryBerlinPassword,
                            territoryBerlinStravaAthleteId,
                            territoryBerlinDisplayName,
                            territoryBerlinSeedMockData,
                            LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_TERRITORY
                    )
            );
            log.info(
                    "[Hermes] Berlin territory conqueror {} is ready (seeded shoes={}, seeded activities={}).",
                    berlinResult.email(),
                    berlinResult.seededShoes(),
                    berlinResult.seededActivities()
            );

            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_BLUE
            );
            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_GREEN
            );
            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_GOLD
            );
            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_PINK
            );
            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_LIME
            );
            bootstrapBerlinRival(
                    bootstrapService,
                    territoryBerlinPassword,
                    LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_CYAN
            );
        };
    }

    private void bootstrapBerlinRival(
            LocalSharedRunnerBootstrapService bootstrapService,
            String password,
            LocalSharedRunnerBootstrapService.SeedProfile seedProfile
    ) {
        LocalSharedRunnerBootstrapService.BootstrapResult result = bootstrapService.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.berlinRivalDefault(password, seedProfile)
        );
        log.info(
                "[Hermes] Berlin territory rival {} is ready (seeded shoes={}, seeded activities={}).",
                result.email(),
                result.seededShoes(),
                result.seededActivities()
        );
    }
}
