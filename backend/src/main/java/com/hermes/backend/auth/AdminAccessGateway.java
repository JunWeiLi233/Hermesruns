package com.hermes.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies the signed Cloudflare Access application assertion at the origin.
 * Unsigned convenience headers are deliberately ignored.
 */
@Component
public class AdminAccessGateway {
    static final String ASSERTION_HEADER = "Cf-Access-Jwt-Assertion";

    private final boolean enabled;
    private final String issuer;
    private final String audience;
    private final Set<String> allowedEmails;
    private final JwtDecoder decoder;

    @Autowired
    public AdminAccessGateway(
            @Value("${app.security.admin-access.enabled:false}") boolean enabled,
            @Value("${app.security.admin-access.team-domain:}") String teamDomain,
            @Value("${app.security.admin-access.audience:}") String audience,
            @Value("${app.security.admin-access.allowed-emails:}") String allowedEmails
    ) {
        this(enabled, teamDomain, audience, allowedEmails, createDecoder(enabled, teamDomain));
    }

    AdminAccessGateway(boolean enabled, String teamDomain, String audience,
                       String allowedEmails, JwtDecoder decoder) {
        this.enabled = enabled;
        this.issuer = stripTrailingSlash(teamDomain);
        this.audience = value(audience);
        this.allowedEmails = Arrays.stream(value(allowedEmails).split(","))
                .map(AdminAccessGateway::normalizeEmail)
                .filter(email -> !email.isBlank())
                .collect(Collectors.toUnmodifiableSet());
        this.decoder = decoder;
    }

    static AdminAccessGateway disabled() {
        return new AdminAccessGateway(false, "", "", "", null);
    }

    public boolean isAllowed(HttpServletRequest request) {
        if (!enabled) {
            return true;
        }
        if (request == null || decoder == null) {
            return false;
        }
        String assertion = value(request.getHeader(ASSERTION_HEADER));
        if (assertion.isBlank() || assertion.length() > 16_384) {
            return false;
        }
        try {
            Jwt jwt = decoder.decode(assertion);
            Instant now = Instant.now();
            String tokenIssuer = jwt.getIssuer() == null ? "" : stripTrailingSlash(jwt.getIssuer().toString());
            String email = normalizeEmail(jwt.getClaimAsString("email"));
            return !issuer.isBlank()
                    && issuer.equals(tokenIssuer)
                    && !audience.isBlank()
                    && jwt.getAudience() != null
                    && jwt.getAudience().contains(audience)
                    && !allowedEmails.isEmpty()
                    && allowedEmails.contains(email)
                    && jwt.getExpiresAt() != null
                    && jwt.getExpiresAt().isAfter(now)
                    && (jwt.getNotBefore() == null || !jwt.getNotBefore().isAfter(now.plusSeconds(30)));
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    private static JwtDecoder createDecoder(boolean enabled, String teamDomain) {
        if (!enabled) {
            return null;
        }
        String issuer = stripTrailingSlash(teamDomain);
        if (issuer.isBlank()) {
            return null;
        }
        return NimbusJwtDecoder.withJwkSetUri(issuer + "/cdn-cgi/access/certs").build();
    }

    private static String normalizeEmail(String email) {
        return value(email).toLowerCase(Locale.ROOT);
    }

    private static String stripTrailingSlash(String value) {
        return value(value).replaceAll("/+$", "");
    }

    private static String value(String input) {
        return input == null ? "" : input.trim();
    }
}
