package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {
    private final RunnerRepository runnerRepository;
    private final PasswordHasher passwordHasher;

    public AuthService(RunnerRepository runnerRepository, PasswordHasher passwordHasher) {
        this.runnerRepository = runnerRepository;
        this.passwordHasher = passwordHasher;
    }

    public String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    public Optional<Runner> findByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return Optional.empty();
        }

        return runnerRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(runner -> !runner.isDeleted());
    }

    public Optional<Runner> authenticate(String email, String rawPassword) {
        Optional<Runner> runnerOptional = findByEmail(email);
        if (runnerOptional.isEmpty()) {
            return Optional.empty();
        }

        Runner runner = runnerOptional.get();
        if (!passwordHasher.matches(rawPassword, runner.getPassword())) {
            return Optional.empty();
        }

        if (passwordHasher.needsMigration(runner.getPassword())) {
            runner.setPassword(passwordHasher.hash(rawPassword));
            runnerRepository.save(runner);
        }

        return Optional.of(runner);
    }

    public void storePassword(Runner runner, String rawPassword) {
        runner.setPassword(passwordHasher.hash(rawPassword));
    }

    private static final int SESSION_DAYS = 30;

    public String issueSessionToken(Runner runner) {
        String token = UUID.randomUUID().toString();
        runner.setSessionToken(hashSessionToken(token));
        runner.setTokenIssuedAt(LocalDateTime.now());
        runnerRepository.save(runner);
        return token;
    }

    public Optional<Runner> findByAuthorizationHeader(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = authorizationHeader.substring("Bearer ".length()).trim();
        if (token.isBlank()) {
            return Optional.empty();
        }

        String hashedToken = hashSessionToken(token);

        Optional<Runner> hashedMatch = runnerRepository.findBySessionToken(hashedToken)
                .filter(runner -> !runner.isDeleted())
                .filter(this::isTokenValid);
        if (hashedMatch.isPresent()) {
            return hashedMatch;
        }

        Optional<Runner> legacyMatch = runnerRepository.findBySessionToken(token)
                .filter(runner -> !runner.isDeleted())
                .filter(this::isTokenValid);
        legacyMatch.ifPresent(runner -> {
            runner.setSessionToken(hashedToken);
            runnerRepository.save(runner);
        });
        return legacyMatch;
    }

    private boolean isTokenValid(Runner runner) {
        LocalDateTime issuedAt = runner.getTokenIssuedAt();
        if (issuedAt == null) {
            // Legacy tokens without a timestamp: accept but re-stamp on next issue
            return true;
        }
        return issuedAt.isAfter(LocalDateTime.now().minusDays(SESSION_DAYS));
    }

    public boolean isAdmin(Runner runner) {
        return runner != null && "ADMIN".equalsIgnoreCase(runner.getRole());
    }

    private String hashSessionToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }
}
