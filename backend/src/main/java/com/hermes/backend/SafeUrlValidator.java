package com.hermes.backend;

import java.net.URI;
import java.util.Locale;

/**
 * Very conservative outbound URL validation to reduce SSRF / unsafe scheme injection.
 * <p>
 * Use this for user-provided URLs that will later be used in the server or returned
 * to the browser as an image src.
 * </p>
 */
public final class SafeUrlValidator {
    private static final int MAX_DATA_URL_METADATA_LENGTH = 64;

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

    public static String validateHttpsUrlOrNull(String url, int maxLen, String fieldName) {
        String validated = validateHttpUrlOrNull(url, maxLen, fieldName);
        if (validated == null) {
            return null;
        }
        URI uri = URI.create(validated);
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException(fieldName + " must use https.");
        }
        return validated;
    }

    /**
     * Allows the standard remote http(s) URLs plus small inline base64 data URLs for
     * admin-uploaded course-map images and PDFs.
     */
    public static String validateHttpUrlOrImageDataUrlOrNull(String url, int maxLen, String fieldName) {
        if (url == null) return null;
        String s = url.trim();
        if (s.isEmpty()) return null;
        if (s.regionMatches(true, 0, "data:", 0, 5)) {
            return validateImageOrPdfDataUrl(s, maxLen, fieldName);
        }
        return validateHttpUrlOrNull(s, maxLen, fieldName);
    }

    private static String validateImageOrPdfDataUrl(String url, int maxLen, String fieldName) {
        if (url.length() > maxLen) {
            throw new IllegalArgumentException(fieldName + " too long.");
        }

        int comma = url.indexOf(',');
        if (comma <= 0 || comma == url.length() - 1) {
            throw new IllegalArgumentException(fieldName + " must be a valid image data URL.");
        }

        String metadata = url.substring(5, comma);
        if (metadata.length() > MAX_DATA_URL_METADATA_LENGTH) {
            throw new IllegalArgumentException(fieldName + " metadata is too long.");
        }
        String lowerMetadata = metadata.toLowerCase(Locale.ROOT);
        String mediaType = lowerMetadata.split(";", 2)[0];
        boolean isAllowedMediaType = mediaType.startsWith("image/") || "application/pdf".equals(mediaType);
        if (!isAllowedMediaType) {
            throw new IllegalArgumentException(fieldName + " must be an image or PDF.");
        }
        if (!lowerMetadata.contains(";base64")) {
            throw new IllegalArgumentException(fieldName + " must use base64 encoding.");
        }

        String base64 = url.substring(comma + 1).trim();
        if (base64.isEmpty()) {
            throw new IllegalArgumentException(fieldName + " is empty.");
        }
        for (int i = 0; i < base64.length(); i++) {
            char ch = base64.charAt(i);
            boolean allowed =
                    (ch >= 'A' && ch <= 'Z') ||
                    (ch >= 'a' && ch <= 'z') ||
                    (ch >= '0' && ch <= '9') ||
                    ch == '+' || ch == '/' || ch == '=' || Character.isWhitespace(ch);
            if (!allowed) {
                throw new IllegalArgumentException(fieldName + " contains invalid base64 data.");
            }
        }

        return url;
    }
}
