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
        setValidTransactionalMail(validator);

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

    @Test
    void productionRequiresResendProvider() {
        assertMailValidationFailure("", "mailProvider", "APP_MAIL_PROVIDER");
        assertMailValidationFailure("smtp", "mailProvider", "APP_MAIL_PROVIDER");
    }

    @Test
    void productionRequiresNonblankResendApiKey() {
        assertMailValidationFailure(" ", "resendApiKey", "RESEND_API_KEY");
    }

    @Test
    void productionRejectsResendApiKeyWithAsciiSpace() {
        assertMailValidationFailure("resend key", "resendApiKey", "RESEND_API_KEY");
    }

    @Test
    void productionRejectsResendApiKeyWithControlCharacter() {
        assertMailValidationFailure("resend\r\nkey", "resendApiKey", "RESEND_API_KEY");
    }

    @Test
    void productionRejectsNonAsciiResendApiKey() {
        assertMailValidationFailure("résend-key", "resendApiKey", "RESEND_API_KEY");
    }

    @Test
    void productionRequiresApprovedFromMailbox() {
        assertMailValidationFailure("mailer@other.example", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure("mailer@mail.hermesruns.com, other@mail.hermesruns.com", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure("mailer@@mail.hermesruns.com", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure("a".repeat(65) + "@mail.hermesruns.com", "mailFrom", "APP_MAIL_FROM");
    }

    @Test
    void productionAllowsApprovedDisplayNameFromMailbox() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(
                validator, "mailFrom", "Hermes <no-reply@mail.hermesruns.com>");

        validator.validate();
    }

    @Test
    void productionAllowsApprovedBareFromMailbox() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, "mailFrom", "no-reply@mail.hermesruns.com");

        validator.validate();
    }

    @Test
    void productionRejectsDisplayNameWithMultipleMailboxes() {
        assertMailValidationFailure(
                "Hermes <no-reply@mail.hermesruns.com>, Other <ops@mail.hermesruns.com>",
                "mailFrom",
                "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsDisplayNameWithExtraAngleBrackets() {
        assertMailValidationFailure(
                "Hermes <<no-reply@mail.hermesruns.com>>", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure(
                "Hermes <no-reply@mail.hermesruns.com><ops@mail.hermesruns.com>",
                "mailFrom",
                "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsQuotedOrCommentedDisplayName() {
        assertMailValidationFailure(
                "\"Hermes\" <no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure(
                "Hermes (Transactional) <no-reply@mail.hermesruns.com>",
                "mailFrom",
                "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsDisplayNameWithControlCharacters() {
        assertMailValidationFailure(
                "Hermes\r\nBcc: victim@example.com <no-reply@mail.hermesruns.com>",
                "mailFrom",
                "APP_MAIL_FROM");
        assertMailValidationFailure(
                "Hermes\u0000 <no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsDisplayNameWithRecipientDelimiters() {
        assertMailValidationFailure(
                "Hermes, Mail <no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure(
                "Hermes; Mail <no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsEmptyDisplayName() {
        assertMailValidationFailure("<no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
        assertMailValidationFailure("  <no-reply@mail.hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
    }

    @Test
    void productionRejectsDisplayNameMailboxAtWrongDomain() {
        assertMailValidationFailure(
                "Hermes <no-reply@hermesruns.com>", "mailFrom", "APP_MAIL_FROM");
    }

    @Test
    void productionRequiresApprovedReplyToMailbox() {
        assertMailValidationFailure("help@hermesruns.com", "mailReplyTo", "APP_MAIL_REPLY_TO");
        assertMailValidationFailure(" ", "mailReplyTo", "APP_MAIL_REPLY_TO");
    }

    @Test
    void productionRequiresSafeHttpsPublicBaseUrl() {
        assertMailValidationFailure(" ", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("http://app.hermesruns.com", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://localhost", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://127.0.0.1", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://[::1]", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://[::1%25lo]/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://[::1%251]/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://localhost./", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://dev.localhost./", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://user@app.hermesruns.com", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com/?next=https://attacker.example", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com/#fragment", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com/<script>", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com/%0D%0AInjected:yes", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com/%3Cscript%3E", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com:99999", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://app.hermesruns.com\nHeader: injected", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
        assertMailValidationFailure("https://", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionRejectsIpv4MappedIpv6LoopbackPublicBaseUrl() {
        assertMailValidationFailure("https://[::ffff:127.0.0.1]/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionRejectsLegacyIntegerIpv4LoopbackPublicBaseUrl() {
        assertMailValidationFailure("https://2130706433/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionRejectsLegacyHexadecimalIpv4LoopbackPublicBaseUrl() {
        assertMailValidationFailure("https://0x7f000001/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionRejectsLegacyOctalIpv4LoopbackPublicBaseUrl() {
        assertMailValidationFailure("https://0177.0.0.1/", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionRejectsUtf8EncodedWhitespaceInPublicBaseUrl() {
        assertMailValidationFailure("https://app.hermesruns.com/%C2%A0", "mailPublicBaseUrl", "APP_PUBLIC_BASE_URL");
    }

    @Test
    void productionAllowsNonLoopbackIpv6PublicBaseUrl() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, "mailPublicBaseUrl", "https://[2001:db8::1]/");

        validator.validate();
    }

    @Test
    void productionAllowsCanonicalNonLoopbackIpv4PublicBaseUrl() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, "mailPublicBaseUrl", "https://198.51.100.9/");

        validator.validate();
    }

    @Test
    void productionAllowsNormalPublicBaseUrlPath() {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, "mailPublicBaseUrl", "https://app.hermesruns.com/password/reset");

        validator.validate();
    }

    @Test
    void productionAllowsValidTransactionalMailConfiguration() {
        ProductionSecurityValidator validator = secureProductionValidator();

        validator.validate();
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
        setValidTransactionalMail(validator);
        return validator;
    }

    private void setValidTransactionalMail(ProductionSecurityValidator validator) {
        ReflectionTestUtils.setField(validator, "mailProvider", "resend");
        ReflectionTestUtils.setField(validator, "resendApiKey", "resend-secret");
        ReflectionTestUtils.setField(validator, "mailFrom", "noreply@mail.hermesruns.com");
        ReflectionTestUtils.setField(validator, "mailReplyTo", "support@hermesruns.com");
        ReflectionTestUtils.setField(validator, "mailPublicBaseUrl", "https://app.hermesruns.com");
    }

    private void assertMailValidationFailure(String configuredValue, String fieldName, String environmentVariable) {
        ProductionSecurityValidator validator = secureProductionValidator();
        ReflectionTestUtils.setField(validator, fieldName, configuredValue);

        var assertion = assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(environmentVariable);
        if (!configuredValue.trim().isEmpty()) {
            assertion.hasMessageNotContaining(configuredValue.trim());
        }
    }
}
