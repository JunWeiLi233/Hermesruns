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

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RECAPTCHA_SECRET_KEY");
    }
}
