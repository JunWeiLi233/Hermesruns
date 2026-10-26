package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AdminMfaSessionTests {

    @Test
    void ordinarySessionIssuanceNeverCreatesAdminMfaProof() {
        Runner admin = new Runner();
        AuthService authService = serviceFor(admin);
        admin.setRole("ADMIN");
        admin.setAdminMfaVerifiedAt(LocalDateTime.now());
        admin.setAdminMfaMethod("PASSKEY");

        authService.issueSessionToken(admin);

        assertThat(admin.getAdminMfaVerifiedAt()).isNull();
        assertThat(admin.getAdminMfaMethod()).isNull();
        assertThat(authService.hasFreshAdminMfa(admin)).isFalse();
    }

    @Test
    void mfaSessionIssuanceCreatesShortLivedAdminProof() {
        Runner admin = new Runner();
        AuthService authService = serviceFor(admin);
        admin.setRole("ADMIN");

        authService.issueMfaVerifiedAdminSessionToken(admin, "PASSKEY");

        assertThat(admin.getAdminMfaVerifiedAt()).isAfter(LocalDateTime.now().minusMinutes(1));
        assertThat(admin.getAdminMfaMethod()).isEqualTo("PASSKEY");
        assertThat(authService.hasFreshAdminMfa(admin)).isTrue();
    }

    private AuthService serviceFor(Runner runner) {
        runner.setId(1L);
        RunnerRepository repository = mock(RunnerRepository.class);
        org.mockito.Mockito.when(repository.findByIdForUpdate(1L)).thenReturn(java.util.Optional.of(runner));
        return new AuthService(repository, mock(PasswordHasher.class));
    }
}
