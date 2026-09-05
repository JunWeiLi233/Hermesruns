package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.mail.MailDeliveryException;
import com.hermes.backend.infrastructure.mail.TransactionalMailMessage;
import com.hermes.backend.infrastructure.mail.TransactionalMailSender;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final int TOKEN_HOURS = 48;

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final TransactionalMailSender transactionalMailSender;

    @Value("${app.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;

    public EmailVerificationService(
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
        } catch (MailDeliveryException exception) {
            log.error("Verification email delivery failed runnerId={}", id);
            if (deleteRunnerRowOnMailFailure && id != null) {
                runnerRepository.deleteById(id);
            }
            throw exception;
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
        String base = trimTrailingSlash(publicBaseUrl);
        String link = base + "/api/auth/verify-email?token=" + plainToken;
        String text =
                "Welcome to Hermes.\n\n"
                        + "Open this link to verify your email (expires in " + TOKEN_HOURS + " hours):\n"
                        + link
                        + "\n\nIf you did not sign up, ignore this message.\n";
        String html = "<p>Welcome to Hermes.</p>"
                + "<p>Open this link to verify your email (expires in " + TOKEN_HOURS + " hours): "
                + "<a href=\"" + link + "\">Verify your email</a></p>"
                + "<p>If you did not sign up, ignore this message.</p>";
        transactionalMailSender.send(new TransactionalMailMessage(
                toEmail,
                "Verify your Hermes account",
                text,
                html,
                "hermes-email-verification-" + UUID.randomUUID()));
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
