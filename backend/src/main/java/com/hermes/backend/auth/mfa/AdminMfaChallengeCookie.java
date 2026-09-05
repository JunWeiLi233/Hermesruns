package com.hermes.backend.auth.mfa;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Optional;
import org.springframework.http.ResponseCookie;

public final class AdminMfaChallengeCookie {
    public static final String NAME = "hermes_admin_mfa";
    private static final int MAX_LENGTH = 256;

    private AdminMfaChallengeCookie() {}

    public static String issue(String selector, HttpServletRequest request) {
        return cookie(selector, Duration.ofMinutes(5), secure(request)).toString();
    }

    public static String clear(HttpServletRequest request) {
        return cookie("", Duration.ZERO, secure(request)).toString();
    }

    public static Optional<String> read(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie cookie : request.getCookies()) {
            String value = cookie.getValue();
            if (NAME.equals(cookie.getName()) && value != null && !value.isBlank() && value.length() <= MAX_LENGTH) {
                return Optional.of(value);
            }
        }
        return Optional.empty();
    }

    private static ResponseCookie cookie(String value, Duration age, boolean secure) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/api")
                .maxAge(age)
                .build();
    }

    private static boolean secure(HttpServletRequest request) {
        if (request == null) return false;
        if (request.isSecure()) return true;
        String proto = request.getHeader("X-Forwarded-Proto");
        return proto != null && "https".equalsIgnoreCase(proto.split(",", 2)[0].trim());
    }
}
