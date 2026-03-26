package com.hermes.backend;

import java.net.URI;

/**
 * Very conservative outbound URL validation to reduce SSRF / unsafe scheme injection.
 * <p>
 * Use this for user-provided URLs that will later be used in the server or returned
 * to the browser as an image src.
 * </p>
 */
public final class SafeUrlValidator {
    private SafeUrlValidator() {}

    public static String validateHttpUrlOrNull(String url, int maxLen, String fieldName) {
        if (url == null) return null;
        String s = url.trim();
        if (s.isEmpty()) return null;
        if (s.length() > maxLen) {
            throw new IllegalArgumentException(fieldName + " too long.");
        }
        URI u;
        try {
            u = URI.create(s);
        } catch (Exception e) {
            throw new IllegalArgumentException(fieldName + " must be a valid URL.");
        }

        String scheme = u.getScheme();
        if (scheme == null) throw new IllegalArgumentException(fieldName + " must include scheme.");
        String lowerScheme = scheme.toLowerCase();
        if (!("http".equals(lowerScheme) || "https".equals(lowerScheme))) {
            throw new IllegalArgumentException(fieldName + " scheme is not allowed.");
        }

        String host = u.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException(fieldName + " must include a host.");
        }
        String lh = host.toLowerCase();
        if (lh.equals("localhost") || lh.equals("127.0.0.1") || lh.equals("::1") || lh.endsWith(".local")) {
            throw new IllegalArgumentException(fieldName + " host is not allowed.");
        }

        // Basic RFC1918 + link-local blocking
        if (lh.startsWith("10.") ||
                lh.startsWith("192.168.") ||
                lh.startsWith("172.16.") || lh.startsWith("172.17.") || lh.startsWith("172.18.") ||
                lh.startsWith("172.19.") || lh.startsWith("172.20.") || lh.startsWith("172.21.") ||
                lh.startsWith("172.22.") || lh.startsWith("172.23.") || lh.startsWith("172.24.") ||
                lh.startsWith("172.25.") || lh.startsWith("172.26.") || lh.startsWith("172.27.") ||
                lh.startsWith("172.28.") || lh.startsWith("172.29.") || lh.startsWith("172.30.") ||
                lh.startsWith("172.31.") ||
                lh.startsWith("169.254.")) {
            throw new IllegalArgumentException(fieldName + " host is not allowed.");
        }

        // Reject embedded credentials to prevent some URL tricks
        if (u.getUserInfo() != null) {
            throw new IllegalArgumentException(fieldName + " must not include credentials.");
        }

        return s;
    }
}

