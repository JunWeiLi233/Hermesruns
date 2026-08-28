package com.hermes.backend;

/**
 * Normalizes reCAPTCHA values copied from local shell configuration into a
 * deployment variable. Railway stores the value exactly as entered, so a
 * copied PowerShell assignment can accidentally leave wrapping quotes behind.
 */
final class RecaptchaConfiguration {

    private RecaptchaConfiguration() {
    }

    static String normalize(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() >= 2) {
            char first = normalized.charAt(0);
            char last = normalized.charAt(normalized.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                normalized = normalized.substring(1, normalized.length() - 1).trim();
            }
        }
        return normalized;
    }

    static boolean hasText(String value) {
        return !normalize(value).isBlank();
    }
}
