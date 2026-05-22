package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int TOKEN_MINUTES = 60;

    private final AuthService authService;
    private final RunnerRepository runnerRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${app.mail.from:noreply@localhost}")
    private String mailFrom;

    @Value("${app.billing.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public PasswordResetService(AuthService authService, RunnerRepository runnerRepository) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
    }

    public boolean isMailConfigured() {
        return mailSender != null && mailHost != null && !mailHost.isBlank();
    }

    /**
     * Creates a one-time reset token and sends it via email.
     * Token is stored as SHA-256 hash (never stored in plaintext).
     */
    public void sendResetLink(Runner runner) {
        if (!isMailConfigured()) {
            throw new IllegalStateException("Mail is not configured");
        }
        String plain = newPlainToken();
        runner.setPasswordResetTokenHash(authService.hashPlainToken(plain));
        runner.setPasswordResetExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_MINUTES));
        runnerRepository.save(runner);

        String link = trimTrailingSlash(publicBaseUrl) + "/reset-password?token=" + plain;
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(mailFrom);
        msg.setTo(runner.getEmail());
        msg.setSubject("Reset your Hermes password");
        msg.setText(
                "A password reset was requested for your Hermes account.\n\n"
                        + "This link expires in " + TOKEN_MINUTES + " minutes:\n"
                        + link
                        + "\n\nIf you did not request this, ignore this email.\n");
        try {
            mailSender.send(msg);
        } catch (MailException e) {
            log.error("Password reset email failed for {}", runner.getEmail(), e);
            throw e;
        }
    }

    public void clearResetFields(Runner runner) {
        runner.setPasswordResetTokenHash(null);
        runner.setPasswordResetExpiresAt(null);
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) return "http://localhost:8080";
        String u = url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u.isEmpty() ? "http://localhost:8080" : u;
    }

    private static String newPlainToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }
}

