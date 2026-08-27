package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class AdminMfaSessionTests {

    @Test
    void ordinarySessionIssuanceNeverCreatesAdminMfaProof() {
        AuthService authService = new AuthService(mock(RunnerRepository.class), mock(PasswordHasher.class));
        Runner admin = new Runner();
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
        AuthService authService = new AuthService(mock(RunnerRepository.class), mock(PasswordHasher.class));
        Runner admin = new Runner();
        admin.setRole("ADMIN");

        authService.issueMfaVerifiedAdminSessionToken(admin, "PASSKEY");

        assertThat(admin.getAdminMfaVerifiedAt()).isAfter(LocalDateTime.now().minusMinutes(1));
        assertThat(admin.getAdminMfaMethod()).isEqualTo("PASSKEY");
        assertThat(authService.hasFreshAdminMfa(admin)).isTrue();
    }
}
