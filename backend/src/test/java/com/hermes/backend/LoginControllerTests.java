package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LoginControllerTests {

    @Test
    void loginReturnsTooManyRequestsWhenIpIsBlocked() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        LoginRateLimiter rateLimiter = mock(LoginRateLimiter.class);
        when(rateLimiter.isBlocked("198.51.100.7")).thenReturn(true);
        LoginController controller = controller(runnerRepository, authService, rateLimiter);

        ResponseEntity<?> response = controller.login(validLoginBody(), request("198.51.100.7"));

        assertError(response, HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
    }

    @Test
    void loginBlocksUnverifiedNonAdminRunner() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        LoginRateLimiter rateLimiter = mock(LoginRateLimiter.class);
        when(rateLimiter.isBlocked("198.51.100.8")).thenReturn(false);
        when(authService.normalizeEmail("runner@hermes.test")).thenReturn("runner@hermes.test");
        Runner runner = runner("runner@hermes.test", "USER", false);
        when(authService.authenticate("runner@hermes.test", "Password1!")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);
        LoginController controller = controller(runnerRepository, authService, rateLimiter);

        ResponseEntity<?> response = controller.login(validLoginBody(), request("198.51.100.8"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> payload = (Map<String, String>) response.getBody();
        assertThat(payload).containsEntry("code", "EMAIL_NOT_VERIFIED");
        assertThat(payload.get("error")).contains("verify your email");
        verify(rateLimiter).recordSuccess("198.51.100.8");
    }

    @Test
    void resendVerificationReturnsServiceUnavailableWhenMailIsNotConfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        LoginRateLimiter rateLimiter = mock(LoginRateLimiter.class);
        EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);
        VerificationResendLimiter verificationResendLimiter = mock(VerificationResendLimiter.class);
        when(verificationResendLimiter.allow("198.51.100.9")).thenReturn(true);
        when(authService.normalizeEmail("runner@hermes.test")).thenReturn("runner@hermes.test");
        Runner runner = runner("runner@hermes.test", "USER", false);
        when(runnerRepository.findByEmailIgnoreCase("runner@hermes.test")).thenReturn(Optional.of(runner));
        when(emailVerificationService.isMailConfigured()).thenReturn(false);
        LoginController controller = controller(
                runnerRepository,
                authService,
                rateLimiter,
                mock(SecretEncryptionService.class),
                mock(AiUsageService.class),
                emailVerificationService,
                verificationResendLimiter,
                mock(PasswordResetLimiter.class),
                mock(PasswordResetService.class),
                mock(ApiRateLimiter.class)
        );

        ResponseEntity<?> response = controller.resendVerification(emailOnlyBody(), request("198.51.100.9"));

        assertError(response, HttpStatus.SERVICE_UNAVAILABLE, "Email delivery is not configured on this server.");
    }

    @Test
    void passwordResetConfirmRejectsWeakPassword() {
        LoginController controller = controller(mock(RunnerRepository.class), mock(AuthService.class), mock(LoginRateLimiter.class));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("token", "valid-reset-token");
        body.put("password", "weak");

        ResponseEntity<?> response = controller.confirmPasswordReset(body, request("198.51.100.10"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload).containsEntry("code", "WEAK_PASSWORD");
        assertThat(payload.get("error")).isEqualTo("Password does not meet strength requirements.");
    }

    @Test
    void getAllRunnersRejectsNonAdminToken() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        Runner runner = runner("runner@hermes.test", "USER", true);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);
        LoginController controller = controller(runnerRepository, authService, mock(LoginRateLimiter.class));

        ResponseEntity<?> response = controller.getAllRunners("Bearer runner-token");

        assertError(response, HttpStatus.FORBIDDEN, "Admin privileges required.");
    }

    @Test
    void deleteRunnerRejectsDeletingCurrentAdminAccount() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("admin@hermes.test", "ADMIN", true);
        admin.setId(42L);
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        LoginController controller = controller(runnerRepository, authService, mock(LoginRateLimiter.class));

        ResponseEntity<?> response = controller.deleteRunner(42L, "Bearer admin-token");

        assertError(response, HttpStatus.BAD_REQUEST, "You cannot delete the account you are currently signed in with.");
    }

    @Test
    void updateSubscriptionRejectsInvalidAction() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        Runner admin = runner("admin@hermes.test", "ADMIN", true);
        admin.setId(7L);
        Runner target = runner("runner@hermes.test", "USER", true);
        target.setId(9L);
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(runnerRepository.findById(9L)).thenReturn(Optional.of(target));
        LoginController controller = controller(
                runnerRepository,
                authService,
                mock(LoginRateLimiter.class),
                mock(SecretEncryptionService.class),
                aiUsageService,
                mock(EmailVerificationService.class),
                mock(VerificationResendLimiter.class),
                mock(PasswordResetLimiter.class),
                mock(PasswordResetService.class),
                mock(ApiRateLimiter.class)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", "extend_pro");
        body.put("months", 3);

        ResponseEntity<?> response = controller.updateSubscription(9L, "Bearer admin-token", body);

        assertError(response, HttpStatus.BAD_REQUEST, "Invalid action. Use 'grant_pro' or 'revoke_pro'.");
    }

    @Test
    void getAllRunnersRepairsNullRolesBeforeResponding() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        Runner admin = runner("admin@hermes.test", "ADMIN", true);
        Runner broken = runner("runner@hermes.test", null, true);
        broken.setStatus("ACTIVE");
        broken.setSubscriptionTier("FREE");
        when(authService.findByAuthorizationHeader("Bearer admin-token")).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(runnerRepository.findByDeletedFalseOrderByIdAsc()).thenReturn(List.of(broken));
        LoginController controller = controller(runnerRepository, authService, mock(LoginRateLimiter.class));

        ResponseEntity<?> response = controller.getAllRunners("Bearer admin-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(List.class);
        verify(runnerRepository).saveAll(List.of(broken));
        assertThat(broken.getRole()).isEqualTo("USER");
    }

    private LoginController controller(RunnerRepository runnerRepository, AuthService authService, LoginRateLimiter rateLimiter) {
        return controller(
                runnerRepository,
                authService,
                rateLimiter,
                mock(SecretEncryptionService.class),
                mock(AiUsageService.class),
                mock(EmailVerificationService.class),
                mock(VerificationResendLimiter.class),
                mock(PasswordResetLimiter.class),
                mock(PasswordResetService.class),
                mock(ApiRateLimiter.class)
        );
    }

    private LoginController controller(
            RunnerRepository runnerRepository,
            AuthService authService,
            LoginRateLimiter rateLimiter,
            SecretEncryptionService secretEncryptionService,
            AiUsageService aiUsageService,
            EmailVerificationService emailVerificationService,
            VerificationResendLimiter verificationResendLimiter,
            PasswordResetLimiter passwordResetLimiter,
            PasswordResetService passwordResetService,
            ApiRateLimiter apiRateLimiter
    ) {
        return new LoginController(
                runnerRepository,
                authService,
                rateLimiter,
                secretEncryptionService,
                aiUsageService,
                emailVerificationService,
                verificationResendLimiter,
                passwordResetLimiter,
                passwordResetService,
                apiRateLimiter,
                mock(RecaptchaVerifier.class)
        );
    }

    private Map<String, Object> validLoginBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", "runner@hermes.test");
        body.put("password", "Password1!");
        return body;
    }

    private Map<String, Object> emailOnlyBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", "runner@hermes.test");
        return body;
    }

    private HttpServletRequest request(String ip) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For")).thenReturn(ip);
        when(request.getRemoteAddr()).thenReturn(ip);
        return request;
    }

    private Runner runner(String email, String role, boolean verified) {
        Runner runner = new Runner();
        runner.setId(1L);
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(verified);
        runner.setSubscriptionTier("FREE");
        runner.setCreatedAt(LocalDateTime.now());
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
