package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityValidatorTests {

    @Test
    void productionRequiresRecaptchaSecretWhenSignupWouldOtherwiseSkipVerification() {
        ProductionSecurityValidator validator = new ProductionSecurityValidator();
        ReflectionTestUtils.setField(validator, "environment", "production");
        ReflectionTestUtils.setField(validator, "datasourceUrl", "jdbc:postgresql://db/hermes");
        ReflectionTestUtils.setField(validator, "hstsEnabled", true);
        ReflectionTestUtils.setField(validator, "corsAllowedOrigins", "https://app.hermes.test");
        ReflectionTestUtils.setField(validator, "publicBaseUrl", "https://app.hermes.test");
        ReflectionTestUtils.setField(validator, "stravaClientId", "");
        ReflectionTestUtils.setField(validator, "stravaWebhookVerifyToken", "");
        ReflectionTestUtils.setField(validator, "recaptchaSecretKey", "");
        ReflectionTestUtils.setField(validator, "adminMfaEnabled", true);
        ReflectionTestUtils.setField(validator, "adminMfaRpId", "admin.hermes.test");
        ReflectionTestUtils.setField(validator, "adminMfaAllowedOrigins", "https://admin.hermes.test");
        ReflectionTestUtils.setField(validator, "adminAccessEnabled", true);
        ReflectionTestUtils.setField(validator, "adminAccessTeamDomain", "https://hermes.cloudflareaccess.com");
        ReflectionTestUtils.setField(validator, "adminAccessAudience", "access-audience");
        ReflectionTestUtils.setField(validator, "adminAccessAllowedEmails", "admin@hermes.test");

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RECAPTCHA_SECRET_KEY");
    }

    @Test
    void productionRequiresAdminMfaAndCloudflareAccess() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, "adminMfaEnabled", false);

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("HERMES_ADMIN_MFA_ENABLED");

        ReflectionTestUtils.setField(validator, "adminMfaEnabled", true);
        ReflectionTestUtils.setField(validator, "adminAccessEnabled", false);

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("HERMES_ADMIN_ACCESS_ENABLED");
    }

    private ProductionSecurityValidator secureProductionValidator() {
        ProductionSecurityValidator validator = new ProductionSecurityValidator();
        ReflectionTestUtils.setField(validator, "environment", "production");
        ReflectionTestUtils.setField(validator, "datasourceUrl", "jdbc:postgresql://db/hermes");
        ReflectionTestUtils.setField(validator, "hstsEnabled", true);
        ReflectionTestUtils.setField(validator, "corsAllowedOrigins", "https://app.hermes.test");
        ReflectionTestUtils.setField(validator, "publicBaseUrl", "https://app.hermes.test");
        ReflectionTestUtils.setField(validator, "stravaClientId", "");
        ReflectionTestUtils.setField(validator, "stravaWebhookVerifyToken", "");
        ReflectionTestUtils.setField(validator, "recaptchaSecretKey", "recaptcha-secret");
        ReflectionTestUtils.setField(validator, "recaptchaSiteKey", "recaptcha-site");
        ReflectionTestUtils.setField(validator, "adminMfaEnabled", true);
        ReflectionTestUtils.setField(validator, "adminMfaRpId", "admin.hermes.test");
        ReflectionTestUtils.setField(validator, "adminMfaAllowedOrigins", "https://admin.hermes.test");
        ReflectionTestUtils.setField(validator, "adminAccessEnabled", true);
        ReflectionTestUtils.setField(validator, "adminAccessTeamDomain", "https://hermes.cloudflareaccess.com");
        ReflectionTestUtils.setField(validator, "adminAccessAudience", "access-audience");
        ReflectionTestUtils.setField(validator, "adminAccessAllowedEmails", "admin@hermes.test");
        return validator;
    }
}
