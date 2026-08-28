package com.hermes.backend;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Fails fast in production when known-weak defaults would be exposed on the public internet.
 */
@Component
public class ProductionSecurityValidator {

    private static final String DEFAULT_STRAVA_VERIFY = "hermes-strava-webhook";

    @Value("${hermes.environment:development}")
    private String environment;

    @Value("${strava.client.id:}")
    private String stravaClientId;

    @Value("${strava.webhook.verify-token:}")
    private String stravaWebhookVerifyToken;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.security.enable-hsts:false}")
    private boolean hstsEnabled;

    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Value("${app.billing.public-base-url:}")
    private String publicBaseUrl;

    @Value("${app.mail.provider:disabled}")
    private String mailProvider;

    @Value("${app.mail.resend.api-key:}")
    private String resendApiKey;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${app.mail.reply-to:}")
    private String mailReplyTo;

    @Value("${app.public-base-url:}")
    private String mailPublicBaseUrl;

    @Value("${recaptcha.secret-key:}")
    private String recaptchaSecretKey;

    @Value("${recaptcha.site-key:}")
    private String recaptchaSiteKey;

    @Value("${app.security.admin-mfa.enabled:true}")
    private boolean adminMfaEnabled;

    @Value("${app.security.admin-mfa.rp-id:localhost}")
    private String adminMfaRpId;

    @Value("${app.security.admin-mfa.allowed-origins:http://localhost:8080}")
    private String adminMfaAllowedOrigins;

    @Value("${app.security.admin-mfa.bootstrap-token:}")
    private String adminMfaBootstrapToken;

    @Value("${app.security.admin-access.enabled:false}")
    private boolean adminAccessEnabled;

    @Value("${app.security.admin-access.team-domain:}")
    private String adminAccessTeamDomain;

    @Value("${app.security.admin-access.audience:}")
    private String adminAccessAudience;

    @Value("${app.security.admin-access.allowed-emails:}")
    private String adminAccessAllowedEmails;

    @PostConstruct
    void validate() {
        if (!isProduction()) {
            return;
        }
        validateDatasource();
        validateHsts();
        validateCorsOrigins();
        validatePublicBaseUrl();
        validateTransactionalMail();
        validateStravaWebhookToken();
        validateAdminSecurity();
        validateRecaptchaKeys();
    }

    private void validateAdminSecurity() {
        if (!adminMfaEnabled) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_MFA_ENABLED must be true.");
        }
        String rpId = normalize(adminMfaRpId);
        if (rpId.isBlank() || "localhost".equals(rpId) || rpId.contains("*") || rpId.contains("://")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_WEBAUTHN_RP_ID must be a non-loopback DNS domain.");
        }
        String[] origins = normalize(adminMfaAllowedOrigins).split(",");
        if (origins.length == 0) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_WEBAUTHN_ALLOWED_ORIGINS is required.");
        }
        for (String originValue : origins) {
            String origin = normalize(originValue);
            if (origin.isBlank() || !origin.startsWith("https://") || origin.contains("*")
                    || origin.contains("localhost") || origin.contains("127.0.0.1")) {
                throw new IllegalStateException(
                        "HERMES_ENV=production: HERMES_WEBAUTHN_ALLOWED_ORIGINS must contain exact HTTPS origins only.");
            }
        }
        if (!value(adminMfaBootstrapToken).isBlank() && value(adminMfaBootstrapToken).length() < 32) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_MFA_BOOTSTRAP_TOKEN must be at least 32 characters when set.");
        }
        if (!adminAccessEnabled) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_ACCESS_ENABLED must be true.");
        }
        String teamDomain = normalize(adminAccessTeamDomain);
        if (!teamDomain.startsWith("https://") || !teamDomain.endsWith(".cloudflareaccess.com")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_ACCESS_TEAM_DOMAIN must be the HTTPS Cloudflare Access team domain.");
        }
        if (normalize(adminAccessAudience).isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_ACCESS_AUDIENCE is required.");
        }
        if (normalize(adminAccessAllowedEmails).isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: HERMES_ADMIN_ACCESS_ALLOWED_EMAILS is required.");
        }
    }

    private void validateRecaptchaKeys() {
        if (recaptchaSecretKey == null || recaptchaSecretKey.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: set RECAPTCHA_SECRET_KEY so signup bot protection is active.");
        }
        if (recaptchaSiteKey == null || recaptchaSiteKey.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: set RECAPTCHA_SITE_KEY so signup can generate verification tokens.");
        }
    }

    private void validateStravaWebhookToken() {
        if (stravaClientId == null || stravaClientId.isBlank()) {
            return;
        }
        if (stravaWebhookVerifyToken == null || stravaWebhookVerifyToken.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production and Strava is enabled: set STRAVA_WEBHOOK_VERIFY_TOKEN to a long random secret.");
        }
        if (DEFAULT_STRAVA_VERIFY.equals(stravaWebhookVerifyToken.trim())) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: STRAVA_WEBHOOK_VERIFY_TOKEN must not use the default 'hermes-strava-webhook'.");
        }
    }

    private void validateDatasource() {
        String normalized = normalize(datasourceUrl);
        if (normalized.startsWith("jdbc:h2:")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: local H2 is not allowed. Configure APP_DB_URL/APP_DB_DRIVER for managed PostgreSQL.");
        }
    }

    private void validateHsts() {
        if (!hstsEnabled) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: enable HSTS by setting APP_ENABLE_HSTS=true behind HTTPS.");
        }
    }

    private void validateCorsOrigins() {
        String normalized = normalize(corsAllowedOrigins);
        if (normalized.isBlank()) {
            return;
        }
        String[] origins = normalized.split(",");
        for (String rawOrigin : origins) {
            String origin = normalize(rawOrigin);
            if (origin.contains("localhost") || origin.contains("127.0.0.1")) {
                throw new IllegalStateException(
                        "HERMES_ENV=production: APP_CORS_ALLOWED_ORIGINS must not include localhost origins.");
            }
            if (origin.startsWith("http://")) {
                throw new IllegalStateException(
                        "HERMES_ENV=production: APP_CORS_ALLOWED_ORIGINS must use HTTPS origins only.");
            }
        }
    }

    private void validatePublicBaseUrl() {
        String normalized = normalize(publicBaseUrl);
        if (normalized.isBlank()) {
            return;
        }
        if (normalized.contains("localhost") || normalized.contains("127.0.0.1")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_PUBLIC_BASE_URL must not point to localhost.");
        }
        if (!normalized.startsWith("https://")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_PUBLIC_BASE_URL must use HTTPS.");
        }
    }

    private void validateTransactionalMail() {
        if (!"resend".equals(mailProvider)) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_MAIL_PROVIDER must be resend.");
        }
        if (!isSafeHeaderToken(resendApiKey)) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: RESEND_API_KEY is required.");
        }
        if (!isApprovedFromMailbox(mailFrom)) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_MAIL_FROM must be one mailbox at mail.hermesruns.com.");
        }
        if (!"support@hermesruns.com".equalsIgnoreCase(mailReplyTo)) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_MAIL_REPLY_TO must be support@hermesruns.com.");
        }
        if (!isSafePublicBaseUrl(mailPublicBaseUrl)) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_PUBLIC_BASE_URL must be a safe absolute HTTPS URL outside loopback.");
        }
    }

    private boolean isApprovedFromMailbox(String address) {
        if (address == null || address.isBlank() || containsControlCharacter(address)) {
            return false;
        }
        int openBracket = address.indexOf('<');
        int closeBracket = address.indexOf('>');
        if (openBracket < 0 && closeBracket < 0) {
            return isApprovedBareMailbox(address);
        }
        if (openBracket < 2
                || closeBracket != address.length() - 1
                || openBracket != address.lastIndexOf('<')
                || closeBracket != address.lastIndexOf('>')
                || address.charAt(openBracket - 1) != ' ') {
            return false;
        }
        String displayName = address.substring(0, openBracket - 1);
        String mailbox = address.substring(openBracket + 1, closeBracket);
        return isConservativeAsciiDisplayName(displayName) && isApprovedBareMailbox(mailbox);
    }

    private boolean isApprovedBareMailbox(String address) {
        if (address.isBlank() || containsBareMailboxDelimiterOrControl(address)) {
            return false;
        }
        int at = address.indexOf('@');
        if (at <= 0 || at != address.lastIndexOf('@') || at == address.length() - 1) {
            return false;
        }
        String localPart = address.substring(0, at);
        String domain = address.substring(at + 1);
        return isValidLocalPart(localPart) && "mail.hermesruns.com".equalsIgnoreCase(domain);
    }

    private boolean isConservativeAsciiDisplayName(String displayName) {
        if (displayName.isEmpty()) {
            return false;
        }
        boolean previousWasSpace = false;
        for (int index = 0; index < displayName.length(); index++) {
            char character = displayName.charAt(index);
            if (character == ' ') {
                if (index == 0 || index == displayName.length() - 1 || previousWasSpace) {
                    return false;
                }
                previousWasSpace = true;
            } else if (isAsciiLetterOrDigit(character)) {
                previousWasSpace = false;
            } else {
                return false;
            }
        }
        return true;
    }

    private boolean isSafeHeaderToken(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < '!' || character > '~') {
                return false;
            }
        }
        return true;
    }

    private boolean containsControlCharacter(String value) {
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) {
                return true;
            }
        }
        return false;
    }

    private boolean containsBareMailboxDelimiterOrControl(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isWhitespace(character) || Character.isISOControl(character)
                    || "()<>[],:;\\\"".indexOf(character) >= 0) {
                return true;
            }
        }
        return false;
    }

    private boolean isValidLocalPart(String localPart) {
        if (localPart.isEmpty() || localPart.length() > 64 || localPart.startsWith(".")
                || localPart.endsWith(".") || localPart.contains("..")) {
            return false;
        }
        for (int index = 0; index < localPart.length(); index++) {
            char character = localPart.charAt(index);
            if (!(isAsciiLetterOrDigit(character) || ".!#$%&'*+/=?^_`{|}~-".indexOf(character) >= 0)) {
                return false;
            }
        }
        return true;
    }

    private boolean isAsciiLetterOrDigit(char character) {
        return (character >= 'a' && character <= 'z')
                || (character >= 'A' && character <= 'Z')
                || (character >= '0' && character <= '9');
    }

    private boolean isSafePublicBaseUrl(String rawValue) {
        if (rawValue == null || rawValue.isBlank() || containsUnsafeUrlCharacter(rawValue)) {
            return false;
        }
        try {
            URI uri = new URI(rawValue);
            String host = uri.getHost();
            return uri.isAbsolute()
                    && "https".equalsIgnoreCase(uri.getScheme())
                    && host != null
                    && !host.isBlank()
                    && uri.getUserInfo() == null
                    && uri.getQuery() == null
                    && uri.getFragment() == null
                    && (uri.getPort() == -1 || (uri.getPort() >= 1 && uri.getPort() <= 65535))
                    && !isLoopbackHost(host)
                    && !containsEncodedUnsafeUrlCharacter(rawValue);
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    private boolean containsUnsafeUrlCharacter(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isWhitespace(character) || Character.isSpaceChar(character) || Character.isISOControl(character)
                    || "<>\\\"'`".indexOf(character) >= 0) {
                return true;
            }
        }
        return false;
    }

    private boolean containsEncodedUnsafeUrlCharacter(String value) {
        String decoded = percentDecodeUtf8(value);
        return decoded == null || decoded.indexOf('%') >= 0 || containsUnsafeUrlCharacter(decoded);
    }

    private String percentDecodeUtf8(String value) {
        StringBuilder decoded = new StringBuilder(value.length());
        for (int index = 0; index < value.length();) {
            if (value.charAt(index) != '%') {
                decoded.append(value.charAt(index++));
                continue;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            while (index < value.length() && value.charAt(index) == '%') {
                if (index + 2 >= value.length()) {
                    return null;
                }
                int high = Character.digit(value.charAt(index + 1), 16);
                int low = Character.digit(value.charAt(index + 2), 16);
                if (high < 0 || low < 0) {
                    return null;
                }
                bytes.write((high << 4) + low);
                index += 3;
            }
            try {
                decoded.append(StandardCharsets.UTF_8.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(bytes.toByteArray())));
            } catch (CharacterCodingException exception) {
                return null;
            }
        }
        return decoded.toString();
    }

    private boolean isLoopbackHost(String host) {
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if (normalizedHost.endsWith(".")) {
            normalizedHost = normalizedHost.substring(0, normalizedHost.length() - 1);
        }
        if ("localhost".equals(normalizedHost) || normalizedHost.endsWith(".localhost")) {
            return true;
        }
        String addressCandidate = normalizedHost.startsWith("[") && normalizedHost.endsWith("]")
                ? normalizedHost.substring(1, normalizedHost.length() - 1)
                : normalizedHost;
        int scopeIndex = addressCandidate.indexOf('%');
        if (scopeIndex >= 0) {
            addressCandidate = addressCandidate.substring(0, scopeIndex);
        }
        if (isAmbiguousLegacyNumericHost(addressCandidate)) {
            return true;
        }
        if (!isNumericAddressLiteral(addressCandidate)) {
            return false;
        }
        try {
            return InetAddress.getByName(addressCandidate).isLoopbackAddress();
        } catch (UnknownHostException exception) {
            return true;
        }
    }

    private boolean isNumericAddressLiteral(String value) {
        return value.matches("[0-9]+")
                || value.matches("[0-9.]+")
                || (value.contains(":") && value.matches("[0-9a-f:.]+"));
    }

    private boolean isAmbiguousLegacyNumericHost(String value) {
        if (value.matches("0x[0-9a-f]+")) {
            return true;
        }
        if (!value.matches("[0-9.]+")) {
            return false;
        }
        String[] octets = value.split("\\.", -1);
        if (octets.length != 4) {
            return true;
        }
        for (String octet : octets) {
            if (octet.isEmpty() || (octet.length() > 1 && octet.charAt(0) == '0')) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private String value(String value) {
        return value == null ? "" : value;
    }

    private boolean isProduction() {
        return environment != null && "production".equalsIgnoreCase(environment.trim());
    }
}
