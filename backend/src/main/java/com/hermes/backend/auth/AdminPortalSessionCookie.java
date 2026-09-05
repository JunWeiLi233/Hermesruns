package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.http.ResponseCookie;

/**
 * Defines the short-lived, browser-only credential used to open the admin SPA.
 *
 * <p>The cookie is deliberately used only for admin document routes. Admin APIs
 * continue to require an explicit Authorization bearer header, which prevents a
 * browser from turning this cookie into an ambient credential for state changes.</p>
 */
public final class AdminPortalSessionCookie {
    static final String NAME = "hermes_admin_portal";
    static final Duration MAX_AGE = Duration.ofHours(8);

    private static final int MAX_TOKEN_LENGTH = 512;

    private AdminPortalSessionCookie() {
    }

    public static String issue(String token, HttpServletRequest request) {
        return cookie(token, MAX_AGE, isSecureRequest(request)).toString();
    }

    public static String clear(HttpServletRequest request) {
        return cookie("", Duration.ZERO, isSecureRequest(request)).toString();
    }

    static Optional<String> read(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie cookie : request.getCookies()) {
            if (NAME.equals(cookie.getName()) && isSafeToken(cookie.getValue())) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    static boolean isAdminPortalPath(String path) {
        return "/admin".equals(path)
                || "/admin/".equals(path)
                || "/dashboard".equals(path)
                || (path != null && path.startsWith("/dashboard/"))
                || "/workflows".equals(path);
    }

    static boolean isFresh(Runner runner) {
        if (runner == null || runner.getTokenIssuedAt() == null) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime issuedAt = runner.getTokenIssuedAt();
        return issuedAt.isAfter(now.minus(MAX_AGE))
                && !issuedAt.isAfter(now.plusMinutes(5));
    }

    private static ResponseCookie cookie(String value, Duration maxAge, boolean secure) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    private static boolean isSecureRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return forwardedProto != null
                && "https".equalsIgnoreCase(forwardedProto.split(",", 2)[0].trim());
    }

    private static boolean isSafeToken(String token) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return false;
        }
        for (int index = 0; index < token.length(); index++) {
            char character = token.charAt(index);
            if (character <= 0x20 || character >= 0x7f || character == ';' || character == ',') {
                return false;
            }
        }
        return true;
    }
}
