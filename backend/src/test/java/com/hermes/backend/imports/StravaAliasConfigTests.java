package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.auth.OAuthController;
import com.hermes.backend.auth.SecretEncryptionService;
import com.hermes.backend.billing.AiUsageService;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.weather.AcclimatizationService;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class StravaAliasConfigTests {

    @Test
    void appStravaAliasesEnableConfigStatusAndOAuthStartFlow() {
        Map<String, String> previous = setSystemProperties(Map.of(
                "APP_STRAVA_CLIENT_ID", "alias-client-id",
                "APP_STRAVA_CLIENT_SECRET", "alias-client-secret",
                "APP_STRAVA_REDIRECT_URI", "https://example.com/api/auth/strava/callback",
                "APP_DATA_ENCRYPTION_KEY", "test-encryption-key"
        ));
        try {
            try (var context = new SpringApplicationBuilder(TestConfig.class)
                    .properties("spring.main.web-application-type=none")
                    .run()) {
                SystemConfigService systemConfigService = context.getBean(SystemConfigService.class);
                OAuthController controller = context.getBean(OAuthController.class);

                assertTrue(systemConfigService.isStravaConfigured());
                assertEquals("configured", systemConfigService.getStravaStatus().get("mode"));
                assertEquals(Boolean.TRUE, systemConfigService.getStravaStatus().get("clientIdPresent"));
                assertEquals(Boolean.TRUE, systemConfigService.getStravaStatus().get("clientSecretPresent"));

                RedirectView redirectView = controller.startStravaAuth("login");
                String decodedUrl = URLDecoder.decode(redirectView.getUrl(), StandardCharsets.UTF_8);

                assertNotNull(redirectView.getUrl());
                assertTrue(redirectView.getUrl().contains("client_id=alias-client-id"));
                assertTrue(decodedUrl.contains("redirect_uri=https://example.com/api/auth/strava/callback"));
            }
        } finally {
            restoreSystemProperties(previous);
        }
    }

    private static Map<String, String> setSystemProperties(Map<String, String> values) {
        Map<String, String> previous = new LinkedHashMap<>();
        values.forEach((key, value) -> {
            previous.put(key, System.getProperty(key));
            System.setProperty(key, value);
        });
        return previous;
    }

    private static void restoreSystemProperties(Map<String, String> previous) {
        previous.forEach((key, value) -> {
            if (value == null) {
                System.clearProperty(key);
            } else {
                System.setProperty(key, value);
            }
        });
    }

    @Configuration
    @PropertySource("classpath:application.properties")
    static class TestConfig {
        @Bean
        SecretEncryptionService secretEncryptionService(
                @Value("${APP_DATA_ENCRYPTION_KEY:}") String configuredKey
        ) {
            return new SecretEncryptionService(configuredKey);
        }

        @Bean
        SystemConfigService systemConfigService(SecretEncryptionService secretEncryptionService) {
            return new SystemConfigService(secretEncryptionService);
        }

        @Bean
        StravaTokenService stravaTokenService(RunnerRepository runnerRepository,
                                               SecretEncryptionService secretEncryptionService,
                                               RestTemplate restTemplate,
                                               SystemConfigService systemConfigService) {
            return new StravaTokenService(runnerRepository, secretEncryptionService, restTemplate, systemConfigService);
        }

        @Bean
        StravaSyncService stravaSyncService(ActivityRepository activityRepository,
                                             ActivityPointRepository activityPointRepository,
                                             RunnerRepository runnerRepository,
                                             RestTemplate restTemplate,
                                             AcclimatizationService acclimatizationService,
                                             AutomatedCoachService automatedCoachService,
                                             AiUsageService aiUsageService,
                                             StravaTokenService stravaTokenService) {
            return new StravaSyncService(activityRepository, activityPointRepository, runnerRepository,
                    restTemplate, acclimatizationService, automatedCoachService, null, aiUsageService, stravaTokenService, null);
        }

        @Bean
        OAuthController oAuthController(
                RunnerRepository runnerRepository,
                AuthService authService,
                ActivityRepository activityRepository,
                SecretEncryptionService secretEncryptionService,
                AiUsageService aiUsageService,
                RestTemplate restTemplate,
                SystemConfigService systemConfigService,
                StravaTokenService stravaTokenService,
                StravaSyncService stravaSyncService
        ) {
            return new OAuthController(
                    runnerRepository,
                    authService,
                    activityRepository,
                    secretEncryptionService,
                    aiUsageService,
                    restTemplate,
                    systemConfigService,
                    stravaTokenService,
                    stravaSyncService
            );
        }

        @Bean
        RunnerRepository runnerRepository() {
            return mock(RunnerRepository.class);
        }

        @Bean
        AuthService authService() {
            return mock(AuthService.class);
        }

        @Bean
        ActivityRepository activityRepository() {
            return mock(ActivityRepository.class);
        }

        @Bean
        ActivityPointRepository activityPointRepository() {
            return mock(ActivityPointRepository.class);
        }

        @Bean
        AiUsageService aiUsageService() {
            return mock(AiUsageService.class);
        }

        @Bean
        RestTemplate restTemplate() {
            return mock(RestTemplate.class);
        }

        @Bean
        AutomatedCoachService automatedCoachService() {
            return mock(AutomatedCoachService.class);
        }

        @Bean
        AcclimatizationService acclimatizationService() {
            return mock(AcclimatizationService.class);
        }
    }
}
