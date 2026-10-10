package com.hermes.backend.auth;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.billing.AiUsageService;
import com.hermes.backend.imports.StravaAccountService;
import com.hermes.backend.imports.StravaSyncService;
import com.hermes.backend.imports.StravaTokenService;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** DELETE /api/auth/strava/unlink: the endpoint the Settings screen already calls. */
class OAuthControllerUnlinkTests {

    private AuthService authService;
    private StravaAccountService accounts;
    private OAuthController controller;
    private Runner runner;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        accounts = mock(StravaAccountService.class);
        controller = new OAuthController(
                mock(RunnerRepository.class), authService, mock(ActivityRepository.class),
                mock(SecretEncryptionService.class), mock(AiUsageService.class), mock(RestTemplate.class),
                mock(SystemConfigService.class), mock(StravaTokenService.class), mock(StravaSyncService.class));
        controller.setStravaAccountService(accounts);

        runner = new Runner();
        runner.setId(12L);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
    }

    @Test
    @SuppressWarnings("unchecked")
    void disconnectsTheSignedInRunnerAndReportsWhatHappened() {
        when(accounts.unlink(runner)).thenReturn(new StravaAccountService.UnlinkResult(true, 3));

        ResponseEntity<?> response = controller.unlinkStrava("Bearer session-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((Map<String, Object>) response.getBody())
                .containsEntry("unlinked", true)
                .containsEntry("revokedAtStrava", true)
                .containsEntry("removedActivities", 3);
        verify(accounts).unlink(runner);
    }

    @Test
    @SuppressWarnings("unchecked")
    void tellsTheRunnerWhenStravaCouldNotBeToldToRevokeAccess() {
        when(accounts.unlink(runner)).thenReturn(new StravaAccountService.UnlinkResult(false, 0));

        ResponseEntity<?> response = controller.unlinkStrava("Bearer session-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((Map<String, Object>) response.getBody()).containsEntry("revokedAtStrava", false);
    }

    @Test
    @SuppressWarnings("unchecked")
    void requiresASession() {
        ResponseEntity<?> response = controller.unlinkStrava(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat((Map<String, Object>) response.getBody()).containsEntry("code", "UNAUTHORIZED");
        verifyNoInteractions(accounts);
    }

    @Test
    void refusesAnExpiredSessionToken() {
        ResponseEntity<?> response = controller.unlinkStrava("Bearer expired");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(accounts);
    }

    @Test
    void reportsUnavailableInsteadOfPretendingToDisconnectWhenTheServiceIsMissing() {
        controller.setStravaAccountService(null);

        ResponseEntity<?> response = controller.unlinkStrava("Bearer session-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
