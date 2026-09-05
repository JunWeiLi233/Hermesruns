package com.hermes.backend.auth.mfa;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminMfaChallengeService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;

    private final AdminMfaChallengeRepository repository;

    public AdminMfaChallengeService(AdminMfaChallengeRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public CreatedChallenge create(Long runnerId, AdminMfaPurpose purpose, String primaryMethod) {
        if (runnerId == null || purpose == null) {
            throw new IllegalArgumentException("An administrator and MFA purpose are required.");
        }
        byte[] random = new byte[32];
        RANDOM.nextBytes(random);
        String selector = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        AdminMfaChallenge challenge = new AdminMfaChallenge();
        challenge.setSelectorHash(hash(selector));
        challenge.setRunnerId(runnerId);
        challenge.setPurpose(purpose);
        challenge.setPrimaryMethod(safeMethod(primaryMethod));
        challenge.setAttempts(0);
        challenge.setCreatedAt(LocalDateTime.now());
        challenge.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        return new CreatedChallenge(selector, repository.save(challenge));
    }

    @Transactional
    public AdminMfaChallenge requireActive(String selector, AdminMfaPurpose purpose) {
        if (selector == null || selector.isBlank() || selector.length() > 256) {
            throw new AdminMfaException("Admin authentication failed.");
        }
        AdminMfaChallenge challenge = repository.findBySelectorHash(hash(selector))
                .orElseThrow(() -> new AdminMfaException("Admin authentication failed."));
        LocalDateTime now = LocalDateTime.now();
        if (challenge.getPurpose() != purpose
                || challenge.getConsumedAt() != null
                || challenge.getExpiresAt() == null
                || !challenge.getExpiresAt().isAfter(now)
                || challenge.getAttempts() >= MAX_ATTEMPTS) {
            throw new AdminMfaException("Admin authentication failed.");
        }
        return challenge;
    }

    @Transactional
    public AdminMfaChallenge storeRequest(String selector, AdminMfaPurpose purpose, String requestJson) {
        AdminMfaChallenge challenge = requireActive(selector, purpose);
        challenge.setRequestJson(requestJson);
        return repository.save(challenge);
    }

    @Transactional
    public void markBootstrapVerified(String selector) {
        AdminMfaChallenge challenge = requireActive(selector, AdminMfaPurpose.REGISTRATION);
        challenge.setBootstrapVerifiedAt(LocalDateTime.now());
        repository.save(challenge);
    }

    @Transactional
    public void recordFailure(AdminMfaChallenge challenge) {
        challenge.setAttempts(challenge.getAttempts() + 1);
        if (challenge.getAttempts() >= MAX_ATTEMPTS) {
            challenge.setConsumedAt(LocalDateTime.now());
        }
        repository.save(challenge);
    }

    @Transactional
    public void consume(AdminMfaChallenge challenge) {
        if (challenge.getConsumedAt() != null) {
            throw new AdminMfaException("Admin authentication failed.");
        }
        challenge.setConsumedAt(LocalDateTime.now());
        repository.save(challenge);
    }

    public static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }

    private String safeMethod(String primaryMethod) {
        String value = primaryMethod == null ? "UNKNOWN" : primaryMethod.trim().toUpperCase();
        return value.isBlank() ? "UNKNOWN" : value.substring(0, Math.min(32, value.length()));
    }

    public record CreatedChallenge(String selector, AdminMfaChallenge challenge) {}
}
