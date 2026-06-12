package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

@Service
public class SecretEncryptionService {
    private static final String PREFIX = "enc$";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    private final String configuredKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public SecretEncryptionService(@Value("${APP_DATA_ENCRYPTION_KEY:}") String configuredKey) {
        this.configuredKey = configuredKey == null ? "" : configuredKey.trim();
    }

    public boolean isConfigured() {
        return !effectiveConfiguredKey().isBlank();
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        if (isEncrypted(plaintext)) {
            return plaintext;
        }
        if (!isConfigured()) {
            throw new IllegalStateException("APP_DATA_ENCRYPTION_KEY must be set before storing encrypted secrets.");
        }

        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, deriveKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] payload = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(cipherText, 0, payload, iv.length, cipherText.length);

            return PREFIX + Base64.getEncoder().encodeToString(payload);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to encrypt secret value.", exception);
        }
    }

    public String decrypt(String storedValue) {
        if (storedValue == null || storedValue.isBlank()) {
            return storedValue;
        }
        if (!isEncrypted(storedValue)) {
            return storedValue;
        }
        if (!isConfigured()) {
            throw new IllegalStateException("APP_DATA_ENCRYPTION_KEY must be set to decrypt stored secrets.");
        }

        byte[] payload = Base64.getDecoder().decode(storedValue.substring(PREFIX.length()));
        byte[] iv = new byte[IV_LENGTH];
        byte[] cipherText = new byte[payload.length - IV_LENGTH];
        System.arraycopy(payload, 0, iv, 0, IV_LENGTH);
        System.arraycopy(payload, IV_LENGTH, cipherText, 0, cipherText.length);

        // Try PBKDF2 key first; fall back to legacy SHA-256 for tokens encrypted before the upgrade.
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, deriveKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(cipherText);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (AEADBadTagException ignored) {
            // PBKDF2 key failed — attempt legacy SHA-256 key (pre-upgrade token).
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to decrypt stored secret value.", exception);
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, deriveLegacyKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(cipherText);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to decrypt stored secret value (both PBKDF2 and legacy SHA-256 keys failed).", exception);
        }
    }

    /** PBKDF2-derived key — used for all new encryptions. */
    private SecretKeySpec deriveKey() throws NoSuchAlgorithmException, InvalidKeySpecException {
        char[] chars = effectiveConfiguredKey().toCharArray();
        byte[] salt = "hermes-strava-token-salt-v1".getBytes(StandardCharsets.UTF_8);
        PBEKeySpec spec = new PBEKeySpec(chars, salt, 310_000, 256);
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] keyBytes = factory.generateSecret(spec).getEncoded();
        spec.clearPassword();
        return new SecretKeySpec(keyBytes, "AES");
    }

    /** Legacy SHA-256-derived key — kept only for decrypting pre-upgrade tokens. */
    private SecretKeySpec deriveLegacyKey() throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] keyBytes = digest.digest(effectiveConfiguredKey().getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(keyBytes, "AES");
    }

    private String effectiveConfiguredKey() {
        return firstPresent(
                configuredKey,
                System.getProperty("APP_DATA_ENCRYPTION_KEY"),
                System.getenv("APP_DATA_ENCRYPTION_KEY"));
    }

    private static String firstPresent(String... values) {
        if (values == null) return "";
        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }
        return "";
    }
}
