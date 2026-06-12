package com.hermes.backend;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

final class RedisKeySupport {
    private RedisKeySupport() {}

    static String key(String prefix, String kind, String namespace, String rawKey) {
        return token(prefix) + ":" + token(kind) + ":" + token(namespace) + ":" + digest(normalize(rawKey));
    }

    static String key(String prefix, String kind, String namespace, String rawKey, String suffix) {
        return key(prefix, kind, namespace, rawKey) + ":" + token(suffix);
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static String token(String value) {
        String normalized = normalize(value);
        String token = normalized.replaceAll("[^a-z0-9_.-]", "-");
        return token.isBlank() ? "unknown" : token;
    }

    private static String digest(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed, 0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required for Redis cache keys", e);
        }
    }
}
