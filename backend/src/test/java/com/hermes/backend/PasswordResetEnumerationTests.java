package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifies that POST /api/auth/password-reset/request and its alias
 * POST /api/auth/reset-password return an identical HTTP status and
 * identical response body for both an existing email and a nonexistent email.
 *
 * This prevents user-enumeration via differential responses (2026-05-03 finding).
 */
class PasswordResetEnumerationTests {

    private static final String EXISTING_EMAIL = "real@hermes.test";
    private static final String NONEXISTENT_EMAIL = "ghost@hermes.test";

    // -----------------------------------------------------------------------
    // /api/auth/password-reset/request — canonical endpoint
    // -----------------------------------------------------------------------

    @Test
    void passwordResetRequest_existingEmail_returns202WithGenericBody() {
        LoginController controller = controllerWithExistingEmail();

        ResponseEntity<?> response = controller.requestPasswordReset(emailBody(EXISTING_EMAIL), request());

        assertGeneric202(response);
    }

    @Test
    void passwordResetRequest_nonexistentEmail_returns202WithGenericBody() {
        LoginController controller = controllerWithNoEmail();

        ResponseEntity<?> response = controller.requestPasswordReset(emailBody(NONEXISTENT_EMAIL), request());

        assertGeneric202(response);
    }

    @Test
    void passwordResetRequest_identicalStatusAndBodyForBothBranches() {
        LoginController controllerFound = controllerWithExistingEmail();
        LoginController controllerNotFound = controllerWithNoEmail();

        ResponseEntity<?> found = controllerFound.requestPasswordReset(emailBody(EXISTING_EMAIL), request());
        ResponseEntity<?> notFound = controllerNotFound.requestPasswordReset(emailBody(NONEXISTENT_EMAIL), request());

        assertThat(found.getStatusCode()).isEqualTo(notFound.getStatusCode());
        assertThat(found.getBody()).isEqualTo(notFound.getBody());
    }

    // -----------------------------------------------------------------------
    // /api/auth/reset-password — legacy alias
    // -----------------------------------------------------------------------

    @Test
    void passwordResetAlias_existingEmail_returns202WithGenericBody() {
        LoginController controller = controllerWithExistingEmail();

        ResponseEntity<?> response = controller.requestPasswordResetAlias(emailBody(EXISTING_EMAIL), request());

        assertGeneric202(response);
    }

    @Test
    void passwordResetAlias_nonexistentEmail_returns202WithGenericBody() {
        LoginController controller = controllerWithNoEmail();

        ResponseEntity<?> response = controller.requestPasswordResetAlias(emailBody(NONEXISTENT_EMAIL), request());

        assertGeneric202(response);
    }

    @Test
    void passwordResetAlias_identicalStatusAndBodyForBothBranches() {
        LoginController controllerFound = controllerWithExistingEmail();
        LoginController controllerNotFound = controllerWithNoEmail();

        ResponseEntity<?> found = controllerFound.requestPasswordResetAlias(emailBody(EXISTING_EMAIL), request());
        ResponseEntity<?> notFound = controllerNotFound.requestPasswordResetAlias(emailBody(NONEXISTENT_EMAIL), request());

        assertThat(found.getStatusCode()).isEqualTo(notFound.getStatusCode());
        assertThat(found.getBody()).isEqualTo(notFound.getBody());
    }

    // -----------------------------------------------------------------------
    // Rate-limit guard
    // -----------------------------------------------------------------------

    @Test
    void passwordResetRequest_rateLimitedIpReceives429() {
        PasswordResetLimiter limiter = mock(PasswordResetLimiter.class);
        when(limiter.allow(any())).thenReturn(false);

        LoginController controller = controller(mock(RunnerRepository.class), mock(PasswordResetService.class), limiter);

        ResponseEntity<?> response = controller.requestPasswordReset(emailBody(EXISTING_EMAIL), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private LoginController controllerWithExistingEmail() {
        RunnerRepository repo = mock(RunnerRepository.class);
        Runner runner = existingRunner();
        when(repo.findByEmailIgnoreCase(EXISTING_EMAIL)).thenReturn(Optional.of(runner));
        when(repo.findByEmailIgnoreCase(NONEXISTENT_EMAIL)).thenReturn(Optional.empty());

        PasswordResetService resetService = mock(PasswordResetService.class);
        when(resetService.isMailConfigured()).thenReturn(true);
        // sendResetLink is void — no stub needed; mock will do nothing by default.

        PasswordResetLimiter limiter = mock(PasswordResetLimiter.class);
        when(limiter.allow(any())).thenReturn(true);

        return controller(repo, resetService, limiter);
    }

    private LoginController controllerWithNoEmail() {
        RunnerRepository repo = mock(RunnerRepository.class);
        when(repo.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());

        PasswordResetService resetService = mock(PasswordResetService.class);
        when(resetService.isMailConfigured()).thenReturn(true);

        PasswordResetLimiter limiter = mock(PasswordResetLimiter.class);
        when(limiter.allow(any())).thenReturn(true);

        return controller(repo, resetService, limiter);
    }

    private LoginController controller(
            RunnerRepository repo,
            PasswordResetService resetService,
            PasswordResetLimiter limiter
    ) {
        AuthService authService = mock(AuthService.class);
        when(authService.normalizeEmail(any())).thenAnswer(inv -> inv.getArgument(0));

        return new LoginController(
                repo,
                authService,
                mock(LoginRateLimiter.class),
                mock(SecretEncryptionService.class),
                mock(AiUsageService.class),
                mock(EmailVerificationService.class),
                mock(VerificationResendLimiter.class),
                limiter,
                resetService,
                mock(ApiRateLimiter.class),
                mock(RecaptchaVerifier.class)
        );
    }

    private Runner existingRunner() {
        Runner r = new Runner();
        r.setId(1L);
        r.setEmail(EXISTING_EMAIL);
        r.setRole("USER");
        r.setStatus("ACTIVE");
        r.setEmailVerified(true);
        r.setDeleted(false);
        r.setSubscriptionTier("FREE");
        r.setCreatedAt(LocalDateTime.now());
        return r;
    }

    private Map<String, Object> emailBody(String email) {
        return Map.of("email", email);
    }

    private HttpServletRequest request() {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getHeader("X-Forwarded-For")).thenReturn("198.51.100.50");
        when(req.getRemoteAddr()).thenReturn("198.51.100.50");
        return req;
    }

    @SuppressWarnings("unchecked")
    private void assertGeneric202(ResponseEntity<?> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertThat(body).containsEntry("status", "if-account-exists-email-sent");
        // Must not contain any key that reveals account existence.
        assertThat(body).doesNotContainKey("error");
        assertThat(body).doesNotContainKey("found");
        assertThat(body).doesNotContainKey("exists");
    }
}
