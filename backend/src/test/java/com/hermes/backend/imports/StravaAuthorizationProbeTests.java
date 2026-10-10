package com.hermes.backend.imports;

import com.hermes.backend.auth.SecretEncryptionService;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The probe decides whether to delete a runner's data, so these tests pin its most important property:
 * only Strava saying the refresh token itself is invalid counts as a revocation. A rejection of
 * Hermes's own client credentials fails every runner at once and must never read as one.
 */
class StravaAuthorizationProbeTests {

    private static final String TOKEN_URL = "https://www.strava.com/oauth/token";
    private static final String REVOKE_URL = "https://www.strava.com/oauth/revoke";

    private RunnerRepository runners;
    private SecretEncryptionService secrets;
    private RestTemplate rest;
    private SystemConfigService config;
    private StravaTokenService service;
    private Runner runner;

    @BeforeEach
    void setUp() {
        runners = mock(RunnerRepository.class);
        secrets = mock(SecretEncryptionService.class);
        rest = mock(RestTemplate.class);
        config = mock(SystemConfigService.class);
        when(secrets.decrypt(any())).thenAnswer(call -> call.getArgument(0));
        when(secrets.encrypt(any())).thenAnswer(call -> call.getArgument(0));
        when(config.isStravaConfigured()).thenReturn(true);
        service = new StravaTokenService(runners, secrets, rest, config);
        ReflectionTestUtils.setField(service, "stravaClientId", "client-id");
        ReflectionTestUtils.setField(service, "stravaClientSecret", "client-secret");

        runner = new Runner();
        runner.setId(7L);
        runner.setStravaAthleteId(99L);
        runner.setStravaAccessToken("access-1");
        runner.setStravaRefreshToken("refresh-1");
    }

    private static HttpClientErrorException rejection(HttpStatus status, String body) {
        return HttpClientErrorException.create(status, status.getReasonPhrase(), new HttpHeaders(),
                body.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unchecked")
    private void tokenEndpointThrows(RuntimeException failure) {
        when(rest.postForObject(eq(TOKEN_URL), any(HttpEntity.class), eq(Map.class))).thenThrow(failure);
    }

    @Test
    void probeIsActiveAndStoresTheNewTokensWhenStravaIssuesThem() {
        when(rest.postForObject(eq(TOKEN_URL), any(HttpEntity.class), eq(Map.class))).thenReturn(Map.of(
                "access_token", "access-2", "refresh_token", "refresh-2", "expires_at", 1_900_000_000L));

        StravaTokenService.AuthorizationState state = service.probeAuthorization(runner);

        assertThat(state).isEqualTo(StravaTokenService.AuthorizationState.ACTIVE);
        assertThat(runner.getStravaAccessToken()).isEqualTo("access-2");
        assertThat(runner.getStravaRefreshToken()).isEqualTo("refresh-2");
        verify(runners).save(runner);
    }

    @Test
    void probeIsRevokedWhenStravaRejectsTheRefreshToken() {
        tokenEndpointThrows(rejection(HttpStatus.BAD_REQUEST,
                "{\"message\":\"Bad Request\",\"errors\":[{\"resource\":\"RefreshToken\",\"field\":\"refresh_token\",\"code\":\"invalid\"}]}"));

        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.REVOKED);
        verify(runners, never()).save(any());
    }

    @Test
    void probeAlsoReadsAnUnauthorizedAnswerThatNamesTheRefreshToken() {
        tokenEndpointThrows(rejection(HttpStatus.UNAUTHORIZED,
                "{\"message\":\"Authorization Error\",\"errors\":[{\"resource\":\"RefreshToken\",\"field\":\"\",\"code\":\"invalid\"}]}"));

        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.REVOKED);
    }

    @Test
    void probeNeverTreatsRejectedClientCredentialsAsARevocation() {
        // A wrong or rotated client secret makes every runner's refresh fail. That is Hermes's problem,
        // not a runner revoking access, and deleting data for it would wipe everyone.
        tokenEndpointThrows(rejection(HttpStatus.UNAUTHORIZED,
                "{\"message\":\"Authorization Error\",\"errors\":[{\"resource\":\"Application\",\"field\":\"\",\"code\":\"invalid\"}]}"));

        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);
    }

    @Test
    void probeIsUnknownWhenTheRejectionBodyIsMissingOrNotJson() {
        tokenEndpointThrows(rejection(HttpStatus.BAD_REQUEST, ""));
        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);

        tokenEndpointThrows(rejection(HttpStatus.BAD_REQUEST, "<html>Bad Request</html>"));
        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);
    }

    @Test
    void probeIsUnknownForRateLimitsServerErrorsAndNetworkFailures() {
        tokenEndpointThrows(rejection(HttpStatus.TOO_MANY_REQUESTS,
                "{\"errors\":[{\"resource\":\"RefreshToken\",\"field\":\"refresh_token\",\"code\":\"invalid\"}]}"));
        assertThat(service.probeAuthorization(runner)).as("429 is never a revocation").isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);

        tokenEndpointThrows(HttpServerErrorException.create(HttpStatus.BAD_GATEWAY, "Bad Gateway", new HttpHeaders(), new byte[0], StandardCharsets.UTF_8));
        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);

        tokenEndpointThrows(new ResourceAccessException("down", new SocketTimeoutException("timeout")));
        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);
    }

    @Test
    void probeIsUnknownWithoutAToken() {
        runner.setStravaRefreshToken(null);

        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);
        verify(rest, never()).postForObject(any(String.class), any(), any(Class.class));
    }

    @Test
    void probeIsUnknownWhenStravaIsNotConfigured() {
        when(config.isStravaConfigured()).thenReturn(false);

        assertThat(service.probeAuthorization(runner)).isEqualTo(StravaTokenService.AuthorizationState.UNKNOWN);
    }

    @Test
    @SuppressWarnings("unchecked")
    void revokeSendsTheRefreshTokenWithBasicAuthentication() {
        when(rest.postForEntity(eq(REVOKE_URL), any(HttpEntity.class), eq(String.class))).thenReturn(ResponseEntity.ok(""));

        boolean revoked = service.revokeAtStrava(runner);

        assertThat(revoked).isTrue();
        ArgumentCaptor<HttpEntity<MultiValueMap<String, String>>> sent = ArgumentCaptor.forClass(HttpEntity.class);
        verify(rest).postForEntity(eq(REVOKE_URL), sent.capture(), eq(String.class));
        String authorization = sent.getValue().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        assertThat(authorization).startsWith("Basic ");
        assertThat(new String(Base64.getDecoder().decode(authorization.substring("Basic ".length())), StandardCharsets.UTF_8))
                .isEqualTo("client-id:client-secret");
        assertThat(sent.getValue().getBody().getFirst("token")).isEqualTo("refresh-1");
    }

    @Test
    void revokeReportsFailureInsteadOfThrowing() {
        when(rest.postForEntity(eq(REVOKE_URL), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("down"));

        assertThat(service.revokeAtStrava(runner)).isFalse();
    }

    @Test
    void revokeDoesNothingWithoutATokenOrCredentials() {
        runner.setStravaRefreshToken(null);
        assertThat(service.revokeAtStrava(runner)).isFalse();

        runner.setStravaRefreshToken("refresh-1");
        ReflectionTestUtils.setField(service, "stravaClientSecret", "");
        assertThat(service.revokeAtStrava(runner)).isFalse();
        verify(rest, never()).postForEntity(any(String.class), any(), any(Class.class));
    }
}
