package com.hermes.backend;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class PasswordHasher {
    private static final String PREFIX = "pbkdf2";
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 120000;
    private static final int KEY_LENGTH = 256;
    private static final int SALT_LENGTH = 16;

    private final SecureRandom secureRandom = new SecureRandom();

    public String hash(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("Password cannot be blank.");
        }

        byte[] salt = new byte[SALT_LENGTH];
        secureRandom.nextBytes(salt);

        byte[] derivedKey = deriveKey(rawPassword.toCharArray(), salt, ITERATIONS, KEY_LENGTH);

        return String.join(
                "$",
                PREFIX,
                String.valueOf(ITERATIONS),
                Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(derivedKey)
        );
    }

    public boolean matches(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null || storedPassword.isBlank()) {
            return false;
        }

        if (!isHashed(storedPassword)) {
            return rawPassword.equals(storedPassword);
        }

        String[] parts = storedPassword.split("\\$");
        if (parts.length != 4) {
            return false;
        }

        int iterations = Integer.parseInt(parts[1]);
        byte[] salt = Base64.getDecoder().decode(parts[2]);
        byte[] expected = Base64.getDecoder().decode(parts[3]);
        byte[] actual = deriveKey(rawPassword.toCharArray(), salt, iterations, expected.length * 8);

        return MessageDigest.isEqual(expected, actual);
    }

    public boolean needsMigration(String storedPassword) {
        return storedPassword != null && !storedPassword.isBlank() && !isHashed(storedPassword);
    }

    private boolean isHashed(String storedPassword) {
        return storedPassword.startsWith(PREFIX + "$");
    }

    private byte[] deriveKey(char[] password, byte[] salt, int iterations, int keyLength) {
        try {
            PBEKeySpec keySpec = new PBEKeySpec(password, salt, iterations, keyLength);
            SecretKeyFactory secretKeyFactory = SecretKeyFactory.getInstance(ALGORITHM);
            return secretKeyFactory.generateSecret(keySpec).getEncoded();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Failed to hash password.", exception);
        }
    }
}
