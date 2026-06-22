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

    @Value("${app.local-shared-runner.email:#{T(com.hermes.backend.LocalSharedRunnerBootstrapService).DEFAULT_EMAIL}}")
    private String email;

    @Value("${app.local-shared-runner.password:}")
    private String password;

    @Value("${app.local-shared-runner.strava-athlete-id:#{T(com.hermes.backend.LocalSharedRunnerBootstrapService).DEFAULT_STRAVA_ATHLETE_ID}}")
    private Long stravaAthleteId;

    @Value("${app.local-shared-runner.display-name:Hermes Shared Runner}")
    private String displayName;

    @Value("${app.local-shared-runner.seed-mock-data:true}")
    private boolean seedMockData;

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
        };
    }
}
