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

            if (!territoryRivalEnabled) {
                return;
            }

            if (territoryRivalPassword == null || territoryRivalPassword.isBlank()) {
                log.warn("[Hermes] Local territory rival bootstrap is enabled, but APP_LOCAL_TERRITORY_RIVAL_PASSWORD is missing.");
                return;
            }

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
        };
    }
}
