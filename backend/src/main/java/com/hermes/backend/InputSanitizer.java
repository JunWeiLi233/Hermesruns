package com.hermes.backend;

/**
 * Central input validation / sanitization helpers.
 * <p>
 * This does not attempt to be a full HTML sanitizer; it focuses on blocking common injection vectors:
 * - HTML/script tag characters
 * - control characters
 * </p>
 */
public final class InputSanitizer {
    private InputSanitizer() {}

    public static String trimToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }

    public static String requireMaxLen(String v, int maxLen, String fieldName) {
        String s = v == null ? "" : v;
        if (s.length() > maxLen) {
            throw new IllegalArgumentException(fieldName + " too long.");
        }
        return s;
    }

    public static void rejectControlChars(String v, String fieldName) {
        if (v == null) return;
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (c < 0x20 || c == 0x7f) {
                throw new IllegalArgumentException(fieldName + " contains invalid control characters.");
            }
        }
    }

    public static void rejectControlAndHtmlChars(String v, String fieldName) {
        if (v == null) return;
        rejectControlChars(v, fieldName);
        // Block obvious HTML/script injection delimiters.
        if (v.indexOf('<') >= 0 || v.indexOf('>') >= 0 || v.indexOf('&') >= 0) {
            throw new IllegalArgumentException(fieldName + " contains invalid characters.");
        }
        if (v.indexOf('"') >= 0) {
            throw new IllegalArgumentException(fieldName + " contains invalid characters.");
        }
    }
}

