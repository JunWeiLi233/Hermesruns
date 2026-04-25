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
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final int TOKEN_HOURS = 48;

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

    public EmailVerificationService(AuthService authService, RunnerRepository runnerRepository) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
    }

    public boolean isMailConfigured() {
        return mailSender != null && mailHost != null && !mailHost.isBlank();
    }

    /**
     * First-time signup: persist runner (password already set), attach token, send mail.
     * If sending fails and {@code deleteRunnerRowOnMailFailure} is true, the runner row is removed
     * (brand-new signups only). For recycled soft-deleted accounts, pass false so the row is kept.
     */
    public void sendVerificationToNewRunner(Runner runner, boolean deleteRunnerRowOnMailFailure) {
        String plain = newPlainToken();
        applyToken(runner, plain);
        runnerRepository.save(runner);
        Long id = runner.getId();
        try {
            sendMail(runner.getEmail(), plain);
        } catch (MailException e) {
            log.error("Verification email failed for {}; rolling back signup row {}", runner.getEmail(), id, e);
            if (deleteRunnerRowOnMailFailure && id != null) {
                runnerRepository.deleteById(id);
            }
            throw e;
        }
    }

    /** @see #sendVerificationToNewRunner(Runner, boolean) */
    public void sendVerificationToNewRunner(Runner runner) {
        sendVerificationToNewRunner(runner, true);
    }

    /**
     * Resend for an existing unverified account. Updates token. Does not delete the user on failure.
     */
    public void resendVerification(Runner runner) {
        String plain = newPlainToken();
        applyToken(runner, plain);
        runnerRepository.save(runner);
        sendMail(runner.getEmail(), plain);
    }

    public void clearVerificationFields(Runner runner) {
        runner.setEmailVerificationTokenHash(null);
        runner.setEmailVerificationExpiresAt(null);
    }

    private void applyToken(Runner runner, String plain) {
        runner.setEmailVerificationTokenHash(authService.hashPlainToken(plain));
        runner.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(TOKEN_HOURS));
    }

    private String newPlainToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    private void sendMail(String toEmail, String plainToken) {
        if (!isMailConfigured()) {
            throw new IllegalStateException("Mail is not configured");
        }
        String base = trimTrailingSlash(publicBaseUrl);
        String link = base + "/api/auth/verify-email?token=" + plainToken;

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(mailFrom);
        msg.setTo(toEmail);
        msg.setSubject("Verify your Hermes account");
        msg.setText(
                "Welcome to Hermes.\n\n"
                        + "Open this link to verify your email (expires in " + TOKEN_HOURS + " hours):\n"
                        + link
                        + "\n\nIf you did not sign up, ignore this message.\n");

        mailSender.send(msg);
    }

    private static String trimTrailingSlash(String url) {
        if (url == null) {
            return "";
        }
        String u = url.trim();
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u.isEmpty() ? "" : u;
    }
}
