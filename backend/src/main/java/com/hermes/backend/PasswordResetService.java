package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PasswordResetService {
    private static final int TOKEN_MINUTES = 60;

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final TransactionalMailSender transactionalMailSender;

    @Value("${app.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public PasswordResetService(
            AuthService authService,
            RunnerRepository runnerRepository,
            TransactionalMailSender transactionalMailSender) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.transactionalMailSender = transactionalMailSender;
    }

    public boolean isMailConfigured() {
        return transactionalMailSender.isConfigured();
    }

    /**
     * Creates a one-time reset token and sends it via email.
     * Token is stored as SHA-256 hash (never stored in plaintext).
     */
    public void sendResetLink(Runner runner) {
        String plain = newPlainToken();
        runner.setPasswordResetTokenHash(authService.hashPlainToken(plain));
        runner.setPasswordResetExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_MINUTES));
        runnerRepository.save(runner);

        String link = trimTrailingSlash(publicBaseUrl) + "/reset-password?token=" + plain;
        String text =
                "A password reset was requested for your Hermes account.\n\n"
                        + "This link expires in " + TOKEN_MINUTES + " minutes:\n"
                        + link
                        + "\n\nIf you did not request this, ignore this email.\n";
        String html = "<p>A password reset was requested for your Hermes account.</p>"
                + "<p>This link expires in " + TOKEN_MINUTES + " minutes: "
                + "<a href=\"" + link + "\">Reset your password</a></p>"
                + "<p>If you did not request this, ignore this email.</p>";
        transactionalMailSender.send(new TransactionalMailMessage(
                runner.getEmail(),
                "Reset your Hermes password",
                text,
                html,
                "hermes-password-reset-" + UUID.randomUUID()));
    }

    public void clearResetFields(Runner runner) {
        runner.setPasswordResetTokenHash(null);
        runner.setPasswordResetExpiresAt(null);
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) return "";
        String u = url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u.isEmpty() ? "" : u;
    }

    private static String newPlainToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }
}

