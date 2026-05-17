package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Focused security tests for LoginController admin-only endpoints.
 *
 * Task: LoginController IDOR audit (2026-05-03).
 *
 * Both DELETE /api/auth/runners/{id} and POST /api/auth/runners/{id}/subscription
 * are admin-only: a non-admin caller receives 403 before any runner lookup is
 * attempted. The tests below verify the negative path — runner A (non-admin)
 * attempting to act on runner B's id must receive 403.
 */
class LoginControllerSecurityTests {

    // -----------------------------------------------------------------------
    // DELETE /api/auth/runners/{id} — IDOR negative path
    // -----------------------------------------------------------------------

    @Test
    void deleteRunner_nonAdminCallerReceives403_regardlessOfTargetId() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);

        // Runner A is a regular USER (not admin).
        Runner runnerA = runner("a@hermes.test", "USER", true);
        runnerA.setId(10L);
        when(authService.findByAuthorizationHeader("Bearer token-a")).thenReturn(Optional.of(runnerA));
        when(authService.isAdmin(runnerA)).thenReturn(false);

        // Runner B exists but should never be reached given the 403 gate.
        Runner runnerB = runner("b@hermes.test", "USER", true);
        runnerB.setId(20L);
        when(runnerRepository.findById(20L)).thenReturn(Optional.of(runnerB));

        LoginController controller = controller(runnerRepository, authService);

        // Runner A tries to delete runner B — must be rejected before any runner lookup.
        ResponseEntity<?> response = controller.deleteRunner(20L, "Bearer token-a");

        assertError(response, HttpStatus.FORBIDDEN, "Admin privileges required.");
    }

    @Test
    void deleteRunner_missingAuthHeaderReceives403() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        LoginController controller = controller(mock(RunnerRepository.class), authService);

        ResponseEntity<?> response = controller.deleteRunner(99L, null);

        assertError(response, HttpStatus.FORBIDDEN, "Admin privileges required.");
    }

    // -----------------------------------------------------------------------
    // POST /api/auth/runners/{id}/subscription — IDOR negative path
    // -----------------------------------------------------------------------

    @Test
    void updateSubscription_nonAdminCallerReceives403_regardlessOfTargetId() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);

        // Runner A is a regular USER attempting to modify runner B's subscription.
        Runner runnerA = runner("a@hermes.test", "USER", true);
        runnerA.setId(10L);
        when(authService.findByAuthorizationHeader("Bearer token-a")).thenReturn(Optional.of(runnerA));
        when(authService.isAdmin(runnerA)).thenReturn(false);

        Runner runnerB = runner("b@hermes.test", "USER", true);
        runnerB.setId(20L);
        when(runnerRepository.findById(20L)).thenReturn(Optional.of(runnerB));

        LoginController controller = controller(runnerRepository, authService);

        Map<String, Object> body = Map.of("action", "grant_pro", "months", 1);
        ResponseEntity<?> response = controller.updateSubscription(20L, "Bearer token-a", body);

        assertError(response, HttpStatus.FORBIDDEN, "Admin privileges required.");
    }

    @Test
    void updateSubscription_missingAuthHeaderReceives403() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        LoginController controller = controller(mock(RunnerRepository.class), authService);

        Map<String, Object> body = Map.of("action", "grant_pro", "months", 1);
        ResponseEntity<?> response = controller.updateSubscription(99L, null, body);

        assertError(response, HttpStatus.FORBIDDEN, "Admin privileges required.");
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private LoginController controller(RunnerRepository runnerRepository, AuthService authService) {
        return new LoginController(
                runnerRepository,
                authService,
                mock(LoginRateLimiter.class),
                mock(SecretEncryptionService.class),
                mock(AiUsageService.class),
                mock(EmailVerificationService.class),
                mock(VerificationResendLimiter.class),
                mock(PasswordResetLimiter.class),
                mock(PasswordResetService.class),
                mock(ApiRateLimiter.class),
                mock(RecaptchaVerifier.class)
        );
    }

    private Runner runner(String email, String role, boolean verified) {
        Runner r = new Runner();
        r.setEmail(email);
        r.setRole(role);
        r.setStatus("ACTIVE");
        r.setEmailVerified(verified);
        r.setSubscriptionTier("FREE");
        r.setCreatedAt(LocalDateTime.now());
        return r;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
