package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class StravaAliasConfigTests {

    @Test
    void appStravaAliasesEnableConfigStatusAndOAuthStartFlow() {
        try (var context = new SpringApplicationBuilder(TestConfig.class)
                .properties(
                        "spring.main.web-application-type=none",
                        "APP_STRAVA_CLIENT_ID=alias-client-id",
                        "APP_STRAVA_CLIENT_SECRET=alias-client-secret",
                        "APP_STRAVA_REDIRECT_URI=https://example.com/api/auth/strava/callback",
                        "APP_DATA_ENCRYPTION_KEY=test-encryption-key"
                )
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
        OAuthController oAuthController(
                RunnerRepository runnerRepository,
                AuthService authService,
                ActivityRepository activityRepository,
                ActivityPointRepository activityPointRepository,
                SecretEncryptionService secretEncryptionService,
                AiUsageService aiUsageService,
                RestTemplate restTemplate,
                SystemConfigService systemConfigService,
                ApplicationEventPublisher applicationEventPublisher,
                AutomatedCoachService automatedCoachService,
                AcclimatizationService acclimatizationService
        ) {
            return new OAuthController(
                    runnerRepository,
                    authService,
                    activityRepository,
                    activityPointRepository,
                    secretEncryptionService,
                    aiUsageService,
                    restTemplate,
                    systemConfigService,
                    applicationEventPublisher,
                    automatedCoachService,
                    acclimatizationService
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
        ApplicationEventPublisher applicationEventPublisher() {
            return mock(ApplicationEventPublisher.class);
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
